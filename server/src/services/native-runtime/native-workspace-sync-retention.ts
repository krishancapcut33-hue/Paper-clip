import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { inArray, sql } from "drizzle-orm";
import { heartbeatRuns, type Db } from "@paperclipai/db";
import { logger } from "../../middleware/logger.js";
import type { createDeliveryWorkCoordinator } from "../delivery-work-coordinator.js";
import { DELIVERY_QUEUES } from "../delivery-work-notifications.js";
import { workspaceExportCauses } from "../workspace-recovery-source.js";
import { nativeWorkspaceFinalizationLockKey } from "./native-workspace-finalization-ownership.js";
import { NATIVE_WORKSPACE_OWNER_UNVERIFIED } from "./native-workspace-finalization-recovery-state.js";
import { nativeWorkspaceSyncStateRoot, readNativeWorkspaceSyncReference } from "./native-workspace-sync.js";

export const NATIVE_WORKSPACE_SYNC_RETENTION_DEFAULT_DAYS = 7;
export const NATIVE_WORKSPACE_SYNC_RETENTION_RETRY_MS = 15 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRED_PREFIX = ".expired-";
const SETTLED_RUN_STATUSES = ["succeeded", "failed", "cancelled", "timed_out", "interrupted"];
const RETAINED_RECOVERY_STATES = ["scheduled", "running", "awaiting_evidence"];
const RETAINED_WORKSPACE_RECOVERY_STATUSES = ["queued", "recovering"];
const RESTORE_RECOVERY_SCHEMA = "paperclip.workspace-restore-recovery.v1";

export type NativeWorkspaceSyncRetentionOptions = {
  retentionDays?: number;
  dryRun?: boolean;
  maxEntries?: number;
  maxRemovals?: number;
  now?: () => Date;
  stateRoot?: string;
  shouldContinue?: () => boolean;
};

export type NativeWorkspaceSyncRetentionResult = {
  checked: number;
  candidates: number;
  candidateBytes: number;
  expired: number;
  reclaimedBytes: number;
  leftoversRemoved: number;
  failed: number;
  truncated: boolean;
  skipped: Record<string, number>;
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type RunRow = {
  company_id: string;
  status: string;
  finished_at: string | Date | null;
  process_pid: number | null;
  controller_live: boolean;
  owner_present: boolean;
  reference: unknown;
};

function emptyResult(): NativeWorkspaceSyncRetentionResult {
  return {
    checked: 0,
    candidates: 0,
    candidateBytes: 0,
    expired: 0,
    reclaimedBytes: 0,
    leftoversRemoved: 0,
    failed: 0,
    truncated: false,
    skipped: {},
  };
}

function isExpiredLeftover(name: string) {
  return name.startsWith(EXPIRED_PREFIX) && UUID_PATTERN.test(name.slice(EXPIRED_PREFIX.length));
}

async function isRealDirectory(target: string): Promise<boolean> {
  const stat = await fs.lstat(target).catch(() => null);
  return Boolean(stat?.isDirectory() && !stat.isSymbolicLink());
}

async function treeStats(target: string): Promise<{ newestMtimeMs: number; bytes: number }> {
  const stat = await fs.lstat(target);
  let newestMtimeMs = stat.mtimeMs;
  let bytes = stat.blocks * 512;
  if (stat.isDirectory()) {
    for (const name of await fs.readdir(target)) {
      const child = await treeStats(path.join(target, name)).catch(() => null);
      if (!child) continue;
      newestMtimeMs = Math.max(newestMtimeMs, child.newestMtimeMs);
      bytes += child.bytes;
    }
  }
  return { newestMtimeMs, bytes };
}

async function newestMtimeMs(target: string): Promise<number> {
  const stat = await fs.lstat(target);
  let newest = stat.mtimeMs;
  if (stat.isDirectory()) {
    for (const name of await fs.readdir(target)) {
      newest = Math.max(newest, await newestMtimeMs(path.join(target, name)).catch(() => 0));
    }
  }
  return newest;
}

async function removeTree(target: string): Promise<void> {
  await fs.rm(target, { recursive: true, force: true });
}

function finalizationBlocker(row: {
  phase: string;
  lease_owner: string | null;
  next_attempt_at: unknown;
  recovery_state: string | null;
} | undefined): string | null {
  if (!row) return null;
  if (row.lease_owner !== null) return "finalization_leased";
  if (row.next_attempt_at !== null) return "finalization_retry_scheduled";
  if (row.phase === "committed") return null;
  if (row.phase !== "terminal_failure") return "finalization_unsettled";
  if (row.recovery_state !== null && row.recovery_state !== "blocked") return "finalization_recovering";
  return null;
}

async function retentionBlocker(
  tx: Tx,
  input: { runId: string; run: RunRow; settledBefore: Date },
): Promise<string | null> {
  const { runId, run } = input;
  const finishedAt = run.finished_at ? new Date(run.finished_at) : null;
  if (!SETTLED_RUN_STATUSES.includes(run.status)) return "run_unsettled";
  if (!finishedAt || finishedAt >= input.settledBefore) return "recently_finished";
  if (run.process_pid !== null) return "process_live";
  if (run.controller_live) return "controller_live";
  if (run.owner_present) return "finalization_owner";
  const reference = readNativeWorkspaceSyncReference(run.reference);
  if (run.reference == null || !reference) return null;

  const [finalization] = (await tx.execute(sql`
    select phase, lease_owner, next_attempt_at, recovery_state
    from native_run_finalizations where run_id = ${runId}
  `)) as unknown as Array<{ phase: string; lease_owner: string | null; next_attempt_at: unknown; recovery_state: string | null }>;
  const finalizationReason = finalizationBlocker(finalization);
  if (finalizationReason) return finalizationReason;

  const [owners] = (await tx.execute(sql`
    select
      exists(
        select 1 from issue_recovery_actions
        where company_id = ${run.company_id} and evidence->>'runId' = ${runId}
          and status in ('active', 'escalated')
          and cause in (${sql.join(workspaceExportCauses.map((cause) => sql`${cause}`), sql`, `)})
      ) as export_recovery,
      exists(
        select 1 from issue_recovery_actions
        where company_id = ${run.company_id} and evidence->>'runId' = ${runId}
          and status in ('active', 'escalated') and cause = ${NATIVE_WORKSPACE_OWNER_UNVERIFIED}
      ) as owner_unverified,
      exists(
        select 1 from environment_leases
        where company_id = ${run.company_id}
          and (heartbeat_run_id = ${runId} or id::text = ${reference.leaseId})
          and (coalesce(metadata, '{}'::jsonb) ? 'nativeWorkspaceExportResume'
            or metadata->>'pendingCleanupInFlight' = 'true')
      ) as export_resume,
      exists(
        select 1 from environment_leases
        where company_id = ${run.company_id} and id::text = ${reference.leaseId}
          and metadata->'remoteExecutionTermination'->>'state' = 'destroyed'
      ) as lease_destroyed,
      exists(
        select 1 from issue_recovery_actions
        where company_id = ${run.company_id} and evidence->>'runId' = ${runId}
          and (evidence->'systemRecovery'->>'state' in (${sql.join(RETAINED_RECOVERY_STATES.map((state) => sql`${state}`), sql`, `)})
            or evidence->'workspaceRecovery'->>'status' in (${sql.join(RETAINED_WORKSPACE_RECOVERY_STATUSES.map((status) => sql`${status}`), sql`, `)}))
      ) as retained_recovery,
      exists(
        select 1 from issue_recovery_actions
        where company_id = ${run.company_id} and evidence->>'runId' = ${runId}
          and not (evidence ? 'systemRecovery')
          and (evidence->'workspaceRestoreRecovery'->>'schema' = ${RESTORE_RECOVERY_SCHEMA}
            or cause in (${sql.join(workspaceExportCauses.map((cause) => sql`${cause}`), sql`, `)}))
      ) or exists(
        select 1 from heartbeat_runs r
        where r.id = ${runId}
          and not (coalesce(r.result_json, '{}'::jsonb) ? 'systemRecoveryAdoption')
          and (r.result_json->'workspaceRestoreRecovery'->>'schema' = ${RESTORE_RECOVERY_SCHEMA}
            or exists(
              select 1 from environment_leases l
              where l.heartbeat_run_id = r.id and l.lease_policy = 'retain_on_failure'
                and not (coalesce(l.metadata, '{}'::jsonb) ? 'systemRecoveryAdoption')
            ))
      ) as backfill_pending
  `)) as unknown as Array<Record<string, boolean>>;
  if (owners?.export_recovery) return "export_recovery";
  if (owners?.owner_unverified) return "owner_unverified";
  if (owners?.export_resume) return "export_resume";
  if (!owners?.lease_destroyed && owners?.retained_recovery) return "retained_recovery";
  if (owners?.backfill_pending) return "recovery_backfill_pending";
  return null;
}

async function readRun(tx: Tx, runId: string): Promise<RunRow | undefined> {
  const [run] = (await tx.execute(sql`
    select company_id, status, finished_at, process_pid,
      (controller_lease_expires_at is not null and controller_lease_expires_at >= now()) as controller_live,
      (runner_profile_json->>'nativeWorkspaceFinalizationOwner' is not null) as owner_present,
      runner_profile_json->'nativeWorkspaceSync' as reference
    from heartbeat_runs where id = ${runId}
  `)) as unknown as RunRow[];
  return run;
}

export function nativeWorkspaceSyncRetentionService(
  db: Db,
  defaults: NativeWorkspaceSyncRetentionOptions = {},
) {
  let cursor: string | null = null;

  function settings(options: NativeWorkspaceSyncRetentionOptions) {
    const retentionDays = Math.max(
      1,
      options.retentionDays ?? defaults.retentionDays ?? NATIVE_WORKSPACE_SYNC_RETENTION_DEFAULT_DAYS,
    );
    return {
      retentionMs: retentionDays * DAY_MS,
      dryRun: options.dryRun ?? defaults.dryRun ?? false,
      maxEntries: Math.max(1, options.maxEntries ?? defaults.maxEntries ?? 200),
      maxRemovals: Math.max(1, options.maxRemovals ?? defaults.maxRemovals ?? 50),
      now: (options.now ?? defaults.now ?? (() => new Date()))(),
      root: path.resolve(options.stateRoot ?? defaults.stateRoot ?? nativeWorkspaceSyncStateRoot()),
      shouldContinue: options.shouldContinue ?? defaults.shouldContinue ?? (() => true),
    };
  }

  async function listEntries(root: string) {
    return (await fs.readdir(root).catch(() => [] as string[])).sort();
  }

  async function expireFolder(
    root: string,
    name: string,
    input: { settledBefore: Date; dryRun: boolean },
    result: NativeWorkspaceSyncRetentionResult,
  ) {
    const skip = (reason: string) => {
      result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
    };
    const target = path.join(root, name);
    if (path.dirname(target) !== root || !(await isRealDirectory(target))) return skip("unsafe_path");
    const stats = await treeStats(target);
    if (stats.newestMtimeMs >= input.settledBefore.getTime()) return skip("recent_files");

    const decision = await db.transaction(async (tx): Promise<{ reason: string } | { trash: string | null }> => {
      const initial = await readRun(tx, name);
      if (initial) {
        const [lock] = (await tx.execute(sql`
          select pg_try_advisory_xact_lock(hashtextextended(${nativeWorkspaceFinalizationLockKey(initial.company_id, name)}, 0)) as acquired
        `)) as unknown as Array<{ acquired: boolean }>;
        if (lock?.acquired !== true) return { reason: "finalization_locked" };
      }
      const run = initial ? await readRun(tx, name) : undefined;
      if (initial && !run) return { reason: "run_changed" };
      if (run) {
        const reason = await retentionBlocker(tx, { runId: name, run, settledBefore: input.settledBefore });
        if (reason) return { reason };
      }
      if (input.dryRun) return { trash: null };
      if (!(await isRealDirectory(target))) return { reason: "unsafe_path" };
      if ((await newestMtimeMs(target)) >= input.settledBefore.getTime()) return { reason: "recent_files" };
      const trash = path.join(root, `${EXPIRED_PREFIX}${randomUUID()}`);
      await fs.rename(target, trash);
      return { trash };
    });
    if ("reason" in decision) return skip(decision.reason);
    result.candidates++;
    result.candidateBytes += stats.bytes;
    if (!decision.trash) return;
    await removeTree(decision.trash);
    result.expired++;
    result.reclaimedBytes += stats.bytes;
  }

  async function tick(options: NativeWorkspaceSyncRetentionOptions = {}) {
    const config = settings(options);
    const result = emptyResult();
    const settledBefore = new Date(config.now.getTime() - config.retentionMs);
    const names = await listEntries(config.root);
    if (!config.dryRun) {
      for (const name of names.filter(isExpiredLeftover)) {
        try {
          await removeTree(path.join(config.root, name));
          result.leftoversRemoved++;
        } catch (err) {
          result.failed++;
          logger.warn({ err, entry: name }, "native workspace sync retention could not remove a leftover folder");
        }
      }
    }
    const runIds = names.filter((name) => UUID_PATTERN.test(name));
    const pending = cursor ? runIds.filter((name) => name > cursor!) : runIds;
    for (const name of pending) {
      if (!config.shouldContinue() || result.checked >= config.maxEntries || result.candidates >= config.maxRemovals) {
        result.truncated = true;
        break;
      }
      result.checked++;
      cursor = name;
      try {
        await expireFolder(config.root, name, { settledBefore, dryRun: config.dryRun }, result);
      } catch (err) {
        result.failed++;
        logger.warn({ err, runId: name }, "native workspace sync retention skipped a folder");
      }
    }
    if (!result.truncated) cursor = null;
    return result;
  }

  async function nextDeadlineAt(options: NativeWorkspaceSyncRetentionOptions = {}): Promise<number | null> {
    const config = settings(options);
    const at = config.now.getTime();
    const names = await listEntries(config.root);
    if (!config.dryRun && names.some(isExpiredLeftover)) return at;
    const folders: Array<{ runId: string; newestMtimeMs: number }> = [];
    for (const name of names) {
      if (!UUID_PATTERN.test(name)) continue;
      const target = path.join(config.root, name);
      if (!(await isRealDirectory(target))) continue;
      const newest = await newestMtimeMs(target).catch(() => null);
      if (newest !== null) folders.push({ runId: name, newestMtimeMs: newest });
    }
    if (folders.length === 0) return null;
    const runs = await db
      .select({ id: heartbeatRuns.id, status: heartbeatRuns.status, finishedAt: heartbeatRuns.finishedAt })
      .from(heartbeatRuns)
      .where(inArray(heartbeatRuns.id, folders.map((folder) => folder.runId)));
    const byId = new Map(runs.map((run) => [run.id, run]));
    let next = Number.POSITIVE_INFINITY;
    for (const folder of folders) {
      const run = byId.get(folder.runId);
      const settledAt = !run
        ? folder.newestMtimeMs
        : SETTLED_RUN_STATUSES.includes(run.status) && run.finishedAt
          ? Math.max(folder.newestMtimeMs, new Date(run.finishedAt).getTime())
          : null;
      const due = settledAt === null ? at + config.retentionMs : settledAt + config.retentionMs;
      next = Math.min(next, due > at ? due : at + config.retentionMs);
    }
    return next;
  }

  return { tick, nextDeadlineAt };
}

export function registerNativeWorkspaceSyncRetentionWork(
  coordinator: ReturnType<typeof createDeliveryWorkCoordinator>,
  service: ReturnType<typeof nativeWorkspaceSyncRetentionService>,
  input: {
    shouldContinue?: () => boolean;
    onResult: (result: NativeWorkspaceSyncRetentionResult) => void;
  },
) {
  let next: number | null = null;
  return coordinator.register(DELIVERY_QUEUES.nativeWorkspaceSyncRetention, {
    retryMs: NATIVE_WORKSPACE_SYNC_RETENTION_RETRY_MS,
    pausePassiveMaintenance: true,
    run: async (signal) => {
      next = null;
      const result = await service.tick({
        shouldContinue: () => !signal.aborted && (input.shouldContinue?.() ?? true),
      });
      input.onResult(result);
      if (result.truncated) {
        next = Date.now() + 1000;
        return;
      }
      const deadline = await service.nextDeadlineAt();
      const retry = result.failed > 0 || (result.skipped.finalization_locked ?? 0) > 0
        ? Date.now() + NATIVE_WORKSPACE_SYNC_RETENTION_RETRY_MS
        : null;
      next = deadline === null ? retry : retry === null ? deadline : Math.min(deadline, retry);
    },
    hasPending: async () => false,
    nextRunAt: () => next,
  });
}
