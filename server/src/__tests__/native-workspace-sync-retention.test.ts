import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import {
  agents,
  companies,
  createDb,
  environmentLeases,
  heartbeatRuns,
  issueRecoveryActions,
  issues,
  nativeRunFinalizations,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { nativeWorkspaceFinalizationLockKey } from "../services/native-runtime/native-workspace-finalization-ownership.ts";
import {
  NATIVE_WORKSPACE_SYNC_RETENTION_RETRY_MS,
  nativeWorkspaceSyncRetentionService,
  registerNativeWorkspaceSyncRetentionWork,
} from "../services/native-runtime/native-workspace-sync-retention.ts";
import { DELIVERY_QUEUES } from "../services/delivery-work-notifications.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres native workspace sync retention tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function exists(target: string) {
  return fs.lstat(target).then(() => true, () => false);
}

type SeedInput = {
  runStatus?: string;
  finishedDaysAgo?: number | null;
  folderAgeDays?: number;
  reference?: boolean;
  owner?: boolean;
  processPid?: number | null;
  controllerLeaseDaysFromNow?: number | null;
  finalization?: {
    phase: string;
    recoveryState?: string | null;
    leaseOwner?: string | null;
    nextAttemptDaysFromNow?: number | null;
  } | null;
  leaseMetadata?: Record<string, unknown>;
  leasePolicy?: string;
  recoveryAction?: { cause?: string; status?: string; evidence?: Record<string, unknown> };
  resultJson?: Record<string, unknown>;
};

describeEmbeddedPostgres("native workspace sync retention", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let stateRoot = "";
  const now = new Date();

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-native-workspace-sync-retention-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(issueRecoveryActions);
    await db.delete(nativeRunFinalizations);
    await db.delete(environmentLeases);
    await db.delete(heartbeatRuns);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(companies);
    if (stateRoot) await fs.rm(stateRoot, { recursive: true, force: true });
    stateRoot = "";
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function root() {
    if (!stateRoot) stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-native-workspace-sync-"));
    return stateRoot;
  }

  async function writeFolder(name: string, ageDays: number) {
    const folder = path.join(await root(), name);
    await fs.mkdir(folder, { recursive: true });
    const files = ["descriptor.json", "manifest.sqlite", "workspace-seed.tar", "git-seed.tar"];
    for (const file of files) await fs.writeFile(path.join(folder, file), "x".repeat(4096));
    const at = new Date(now.getTime() - ageDays * DAY_MS);
    for (const file of files) await fs.utimes(path.join(folder, file), at, at);
    await fs.utimes(folder, at, at);
    return folder;
  }

  async function seed(input: SeedInput = {}) {
    const companyId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Sync", issuePrefix: `S${companyId.slice(0, 6)}` });
    const [agent] = await db.insert(agents).values({ companyId, name: "Coder" }).returning();
    const [issue] = await db.insert(issues).values({ companyId, title: "Work", status: "done" }).returning();
    const runId = randomUUID();
    const leaseId = randomUUID();
    const runStatus = input.runStatus ?? "succeeded";
    const finishedDaysAgo = input.finishedDaysAgo === undefined ? 10 : input.finishedDaysAgo;
    const profile: Record<string, unknown> = {};
    if (input.reference ?? true) {
      profile.nativeWorkspaceSync = {
        schema: "paperclip.native-workspace-sync/v3",
        state: "finalized",
        descriptorSha256: "a".repeat(64),
        baselineSha256: "b".repeat(64),
        finalHostSha256: null,
        workspaceId: randomUUID(),
        leaseId,
        providerLeaseId: "provider-lease",
        remoteCwd: "/workspace",
      };
    }
    if (input.owner) profile.nativeWorkspaceFinalizationOwner = { token: randomUUID() };
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId: agent!.id,
      status: runStatus,
      issueId: issue!.id,
      nativeIssueId: issue!.id,
      finishedAt: finishedDaysAgo === null ? null : new Date(now.getTime() - finishedDaysAgo * DAY_MS),
      processPid: input.processPid ?? null,
      controllerLeaseExpiresAt: input.controllerLeaseDaysFromNow == null
        ? null
        : new Date(now.getTime() + input.controllerLeaseDaysFromNow * DAY_MS),
      runnerProfileJson: profile,
      resultJson: input.resultJson ?? null,
    });
    const finalization = input.finalization === undefined ? { phase: "committed" } : input.finalization;
    if (finalization) {
      await db.insert(nativeRunFinalizations).values({
        runId,
        companyId,
        issueId: issue!.id,
        phase: finalization.phase,
        recoveryState: finalization.recoveryState ?? null,
        leaseOwner: finalization.leaseOwner ?? null,
        nextAttemptAt: finalization.nextAttemptDaysFromNow == null
          ? null
          : new Date(now.getTime() + finalization.nextAttemptDaysFromNow * DAY_MS),
      });
    }
    if (input.leaseMetadata || input.leasePolicy) {
      await db.insert(environmentLeases).values({
        id: leaseId,
        companyId,
        heartbeatRunId: runId,
        status: "released",
        leasePolicy: input.leasePolicy ?? "ephemeral",
        metadata: input.leaseMetadata ?? {},
      });
    }
    if (input.recoveryAction) {
      await db.insert(issueRecoveryActions).values({
        companyId,
        sourceIssueId: issue!.id,
        kind: "active_run_watchdog",
        ownerType: "system",
        cause: input.recoveryAction.cause ?? "native_continuation_requires_reconciliation",
        fingerprint: randomUUID(),
        status: input.recoveryAction.status ?? "active",
        nextAction: "Recover",
        evidence: { runId, systemRecovery: { state: "complete" }, ...input.recoveryAction.evidence },
      });
    }
    const folder = await writeFolder(runId, input.folderAgeDays ?? 9);
    return { companyId, runId, folder };
  }

  function service() {
    return nativeWorkspaceSyncRetentionService(db, { stateRoot, now: () => now });
  }

  async function expectKept(input: SeedInput, reason: string) {
    const { folder } = await seed(input);
    const result = await service().tick();
    expect(result.expired).toBe(0);
    expect(result.skipped[reason]).toBe(1);
    expect(await exists(folder)).toBe(true);
  }

  it("deletes a settled committed run's folder after the retention window", async () => {
    const { folder } = await seed();
    const result = await service().tick();
    expect(result).toMatchObject({ checked: 1, candidates: 1, expired: 1, failed: 0 });
    expect(result.reclaimedBytes).toBeGreaterThan(0);
    expect(await exists(folder)).toBe(false);
    expect((await fs.readdir(stateRoot)).filter((name) => name.startsWith(".expired-"))).toEqual([]);
  });

  it("deletes committed runs whose recovery state was left behind without a lease", async () => {
    const { folder } = await seed({ finalization: { phase: "committed", recoveryState: "resuming_session" } });
    expect((await service().tick()).expired).toBe(1);
    expect(await exists(folder)).toBe(false);
  });

  it("deletes blocked terminal failures with no recovery owner", async () => {
    const { folder } = await seed({
      runStatus: "failed",
      finalization: { phase: "terminal_failure", recoveryState: "blocked" },
      recoveryAction: { status: "resolved", cause: "native_workspace_sync_out_unrecoverable" },
    });
    expect((await service().tick()).expired).toBe(1);
    expect(await exists(folder)).toBe(false);
  });

  it("deletes orphaned folders and unreferenced settled runs", async () => {
    const orphan = await writeFolder(randomUUID(), 9);
    const { folder } = await seed({ reference: false, finalization: { phase: "observed" } });
    const result = await service().tick();
    expect(result.expired).toBe(2);
    expect(await exists(orphan)).toBe(false);
    expect(await exists(folder)).toBe(false);
  });

  it("keeps folders with recent files or recently finished runs", async () => {
    const recentFiles = await seed({ folderAgeDays: 2 });
    const recentRun = await seed({ finishedDaysAgo: 3 });
    const result = await service().tick();
    expect(result.expired).toBe(0);
    expect(result.skipped).toMatchObject({ recent_files: 1, recently_finished: 1 });
    expect(await exists(recentFiles.folder)).toBe(true);
    expect(await exists(recentRun.folder)).toBe(true);
  });

  it("keeps runs that are not settled", async () => {
    await expectKept({ runStatus: "running", finishedDaysAgo: null }, "run_unsettled");
  });

  it("keeps runs with a live process", async () => {
    await expectKept({ processPid: 1234 }, "process_live");
  });

  it("keeps runs with a live controller lease", async () => {
    await expectKept({ controllerLeaseDaysFromNow: 1 }, "controller_live");
  });

  it("keeps runs with a finalization owner receipt, even without a reference", async () => {
    await expectKept({ owner: true, reference: false }, "finalization_owner");
  });

  it("keeps unsettled finalization phases", async () => {
    await expectKept({ finalization: { phase: "observed" } }, "finalization_unsettled");
  });

  it("keeps retryable failures without a result", async () => {
    await expectKept({ finalization: { phase: "retryable_failure" } }, "finalization_unsettled");
  });

  it("keeps finalizations with a live lease owner", async () => {
    await expectKept({ finalization: { phase: "committed", leaseOwner: "controller" } }, "finalization_leased");
  });

  it("keeps finalizations with a scheduled retry", async () => {
    await expectKept(
      { finalization: { phase: "terminal_failure", nextAttemptDaysFromNow: 1 } },
      "finalization_retry_scheduled",
    );
  });

  it.each(["awaiting_evidence", "awaiting_runner_reattach", "resuming_session", "bootstrap_incomplete"])(
    "keeps terminal failures in recovery state %s",
    async (recoveryState) => {
      await expectKept({ finalization: { phase: "terminal_failure", recoveryState } }, "finalization_recovering");
    },
  );

  it.each(["native_workspace_sync_out_unrecoverable", "native_workspace_sync_out_retry_exhausted"])(
    "keeps runs with an open %s recovery action",
    async (cause) => {
      await expectKept({ recoveryAction: { cause, status: "escalated" } }, "export_recovery");
    },
  );

  it("keeps runs with an open owner-unverified recovery action", async () => {
    await expectKept(
      { recoveryAction: { cause: "native_workspace_finalization_owner_unverified" } },
      "owner_unverified",
    );
  });

  it("keeps runs whose export resume is recorded on the lease", async () => {
    await expectKept({ leaseMetadata: { nativeWorkspaceExportResume: { attempt: 1 } } }, "export_resume");
  });

  it("keeps runs whose lease cleanup is in flight", async () => {
    await expectKept({ leaseMetadata: { pendingCleanupInFlight: true } }, "export_resume");
  });

  it.each([
    { systemRecovery: { state: "scheduled" } },
    { systemRecovery: { state: "running" } },
    { systemRecovery: { state: "awaiting_evidence" } },
    { workspaceRecovery: { status: "queued" } },
    { workspaceRecovery: { status: "recovering" } },
  ])("keeps retained recovery %j on a lease that was not destroyed", async (evidence) => {
    await expectKept(
      { leaseMetadata: { systemRecoveryAdoption: {} }, recoveryAction: { status: "resolved", evidence } },
      "retained_recovery",
    );
  });

  it("deletes when the retained lease was destroyed", async () => {
    const { folder } = await seed({
      leaseMetadata: { remoteExecutionTermination: { state: "destroyed" } },
      recoveryAction: { status: "resolved", evidence: { systemRecovery: { state: "scheduled" } } },
    });
    expect((await service().tick()).expired).toBe(1);
    expect(await exists(folder)).toBe(false);
  });

  it("keeps runs that historical recovery adoption has not reached", async () => {
    await expectKept({ leasePolicy: "retain_on_failure" }, "recovery_backfill_pending");
  });

  it("keeps runs with an unadopted export recovery action", async () => {
    const { runId, folder } = await seed({
      recoveryAction: { status: "resolved", cause: "native_workspace_sync_out_unrecoverable" },
    });
    await db.execute(sql`update issue_recovery_actions set evidence = evidence - 'systemRecovery'
      where evidence->>'runId' = ${runId}`);
    const result = await service().tick();
    expect(result.skipped.recovery_backfill_pending).toBe(1);
    expect(await exists(folder)).toBe(true);
  });

  it("never touches generations, non-UUID names, symlinks, or files", async () => {
    const base = await root();
    const generations = await writeFolder("generations", 30);
    const other = await writeFolder("not-a-run", 30);
    const target = await writeFolder(".outside", 30);
    const linkName = randomUUID();
    await fs.symlink(target, path.join(base, linkName));
    const fileName = randomUUID();
    await fs.writeFile(path.join(base, fileName), "x");
    const old = new Date(now.getTime() - 30 * DAY_MS);
    await fs.utimes(path.join(base, fileName), old, old);
    const result = await service().tick();
    expect(result.expired).toBe(0);
    expect(result.skipped.unsafe_path).toBe(2);
    for (const entry of [generations, other, target, path.join(base, linkName), path.join(base, fileName)]) {
      expect(await exists(entry)).toBe(true);
    }
  });

  it("deletes nothing during a dry run", async () => {
    const { folder } = await seed();
    const leftover = await writeFolder(`.expired-${randomUUID()}`, 1);
    const result = await nativeWorkspaceSyncRetentionService(db, { stateRoot, now: () => now, dryRun: true }).tick();
    expect(result).toMatchObject({ candidates: 1, expired: 0, leftoversRemoved: 0 });
    expect(await exists(folder)).toBe(true);
    expect(await exists(leftover)).toBe(true);
  });

  it("removes leftover expired folders", async () => {
    const leftover = await writeFolder(`.expired-${randomUUID()}`, 0);
    const retiring = await writeFolder(`.retiring-${randomUUID()}`, 30);
    const result = await service().tick();
    expect(result.leftoversRemoved).toBe(1);
    expect(await exists(leftover)).toBe(false);
    expect(await exists(retiring)).toBe(true);
  });

  it("skips a run while its finalization ownership lock is held", async () => {
    const { companyId, runId, folder } = await seed();
    let result: Awaited<ReturnType<ReturnType<typeof service>["tick"]>> | undefined;
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${nativeWorkspaceFinalizationLockKey(companyId, runId)}, 0))`);
      result = await service().tick();
    });
    expect(result?.skipped.finalization_locked).toBe(1);
    expect(await exists(folder)).toBe(true);
    expect((await service().tick()).expired).toBe(1);
  });

  it("bounds each tick and resumes from its cursor", async () => {
    const first = await writeFolder(randomUUID(), 9);
    const second = await writeFolder(randomUUID(), 9);
    const retention = service();
    const initial = await retention.tick({ maxRemovals: 1 });
    expect(initial).toMatchObject({ expired: 1, truncated: true });
    const rest = await retention.tick({ maxRemovals: 1 });
    expect(rest).toMatchObject({ expired: 1, truncated: false });
    expect(await exists(first)).toBe(false);
    expect(await exists(second)).toBe(false);
  });

  it("stops when asked to", async () => {
    const folder = await writeFolder(randomUUID(), 9);
    const result = await service().tick({ shouldContinue: () => false });
    expect(result).toMatchObject({ checked: 0, truncated: true });
    expect(await exists(folder)).toBe(true);
  });

  describe("scheduled worker", () => {
    function register() {
      let queue = "";
      let task!: { run: (signal: AbortSignal) => Promise<unknown>; nextRunAt?: () => number | null };
      const coordinator = {
        register: (registeredQueue: string, registered: typeof task) => {
          queue = registeredQueue;
          task = registered;
          return { ready: Promise.resolve(), wake: () => {} };
        },
      };
      const onResult = vi.fn();
      registerNativeWorkspaceSyncRetentionWork(coordinator as never, service(), { onResult });
      return { queue: () => queue, task: () => task, onResult };
    }

    it("goes quiet with no folders and schedules the next real deadline", async () => {
      await root();
      const worker = register();
      expect(worker.queue()).toBe(DELIVERY_QUEUES.nativeWorkspaceSyncRetention);
      await worker.task().run(new AbortController().signal);
      expect(worker.task().nextRunAt?.()).toBeNull();
      await seed({ finishedDaysAgo: 3, folderAgeDays: 4 });
      await worker.task().run(new AbortController().signal);
      expect(worker.task().nextRunAt?.()).toBe(now.getTime() + 4 * DAY_MS);
      expect(worker.onResult).toHaveBeenCalledTimes(2);
    });

    it("retries soon when the finalization lock was held", async () => {
      const { companyId, runId } = await seed();
      const worker = register();
      const before = Date.now();
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${nativeWorkspaceFinalizationLockKey(companyId, runId)}, 0))`);
        await worker.task().run(new AbortController().signal);
      });
      const next = worker.task().nextRunAt?.() ?? 0;
      expect(next).toBeGreaterThanOrEqual(before + NATIVE_WORKSPACE_SYNC_RETENTION_RETRY_MS);
      expect(next).toBeLessThanOrEqual(Date.now() + NATIVE_WORKSPACE_SYNC_RETENTION_RETRY_MS);
    });
  });

  describe("nextDeadlineAt", () => {
    it("is null without folders", async () => {
      await root();
      await writeFolder("generations", 0);
      expect(await service().nextDeadlineAt()).toBeNull();
    });

    it("is null when the state root does not exist", async () => {
      expect(await nativeWorkspaceSyncRetentionService(db, {
        stateRoot: path.join(os.tmpdir(), `missing-${randomUUID()}`),
        now: () => now,
      }).nextDeadlineAt()).toBeNull();
    });

    it("is due now when a leftover expired folder exists", async () => {
      await writeFolder(`.expired-${randomUUID()}`, 0);
      expect(await service().nextDeadlineAt()).toBe(now.getTime());
    });

    it("is the earliest settled run finish plus the retention window", async () => {
      await seed({ finishedDaysAgo: 3, folderAgeDays: 4 });
      await seed({ finishedDaysAgo: 2, folderAgeDays: 4 });
      expect(await service().nextDeadlineAt()).toBe(now.getTime() + 4 * DAY_MS);
    });

    it("uses the folder's newest file for orphans", async () => {
      await writeFolder(randomUUID(), 5);
      const deadline = await service().nextDeadlineAt();
      expect(Math.abs(deadline! - (now.getTime() + 2 * DAY_MS))).toBeLessThan(1000);
    });

    it("rechecks unsettled or kept folders one retention window later", async () => {
      await seed({ runStatus: "running", finishedDaysAgo: null, folderAgeDays: 30 });
      await seed({ finalization: { phase: "observed" } });
      expect(await service().nextDeadlineAt()).toBe(now.getTime() + 7 * DAY_MS);
    });
  });
});
