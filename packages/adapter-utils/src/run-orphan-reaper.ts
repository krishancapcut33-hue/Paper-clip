import fs from "node:fs/promises";
import path from "node:path";
import { redactCommandText } from "./command-redaction.js";

/**
 * Run-scoped orphan reaper.
 *
 * A local adapter run spawns one child in its own process group. Killing that
 * handle (and, where the platform supports it, the process group) misses a
 * descendant that calls `setsid`: the descendant leaves the group and keeps
 * running after the run is terminal. The durable marker for those processes is
 * the per-run `PAPERCLIP_RUN_ID` value the adapter puts in the child env.
 *
 * This reaper is a supplement to the existing handle/process-group termination,
 * never a replacement. It scans the same PID namespace, selects only processes
 * that carry the exact run marker, and reaps them in bounded passes:
 *
 *   1. an immediate pass at the terminal boundary (SIGTERM, grace, SIGKILL),
 *   2. a bounded periodic sweep for a short window afterwards, so a descendant
 *      that forks after the immediate pass is still covered.
 *
 * Least privilege is structural: the reaper never runs as root, only signals
 * processes owned by the same uid, and never signals itself or its ancestors.
 * PID reuse is handled by re-reading `/proc/<pid>/stat` (start time) before the
 * SIGKILL escalation and by revalidating the run marker on every pass.
 *
 * The reaper cannot see another PID namespace (a sandbox or an SSH host). It
 * reports that the cleanup is unavailable instead of pretending it ran, so a
 * caller never records a false green.
 */

export const RUN_ORPHAN_REAPER_METRIC = "paperclip_run_orphans_reaped";
export const RUN_ORPHAN_REAPER_ALERT_EVENT = "run_orphans_reaped";

const DEFAULT_GRACE_MS = 3_000;
const DEFAULT_MAX_PROCESSES = 64;
const DEFAULT_MAX_RECENT_RUNS = 64;
const DEFAULT_SWEEP_WINDOW_MS = 60_000;
const DEFAULT_SWEEP_INTERVAL_MS = 5_000;
const STAT_SETTLE_MS = 25;

export interface RunOrphanProcessInfo {
  pid: number;
  ppid: number;
  startTime: string;
  command: string;
}

export interface RunOrphanReapResult {
  /** Whether this platform/namespace can be scanned at all. */
  supported: boolean;
  /** Why the reaper could not run, when `supported` is false. */
  reason: string | null;
  /** Matching processes seen on the first pass. */
  found: number;
  /** Processes that received SIGTERM. */
  terminated: number;
  /** Processes that received SIGKILL. */
  killed: number;
  /** Matching processes still visible after the final pass. */
  survivors: number;
  processes: RunOrphanProcessInfo[];
  /** True when the process-group fallback sent SIGTERM. */
  groupTerminated: boolean;
  /** True when the process-group fallback sent SIGKILL. */
  groupKilled: boolean;
}

export interface RunOrphanReapAlert {
  event: typeof RUN_ORPHAN_REAPER_ALERT_EVENT;
  metric: typeof RUN_ORPHAN_REAPER_METRIC;
  runId: string;
  count: number;
  pids: number[];
  commands: string[];
  phase: "terminal" | "sweep";
  /** Set when the process-group fallback ran, even if no marker matched. */
  processGroupId?: number | null;
}

export interface RunOrphanReaperDependencies {
  /** Test seam; defaults to the real platform. */
  platform?: NodeJS.Platform;
  /** Test seam; defaults to `/proc`. */
  procRoot?: string;
  /** Test seam; defaults to this process. */
  selfPid?: number;
  /** Test seam; defaults to the current uid. */
  uid?: number;
  /** Test seam; defaults to `process.kill`. A pid may be negative for a group. */
  kill?: (pid: number, signal: NodeJS.Signals | 0) => void;
  /** Test seam; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Test seam; defaults to `Date.now`. */
  now?: () => number;
  /** Test seam; receives the structured audit/alert line. */
  writeAlert?: (line: string) => void;
}

export interface ListRunOrphanProcessesInput extends RunOrphanReaperDependencies {
  runId: string;
  /**
   * A per-invocation marker in addition to the run id. One run id can cover
   * several invocations (a model probe followed by the real adapter process),
   * so the run id alone would let a probe's delayed sweep find and kill the
   * later invocation. When this is set, both markers must match.
   */
  processToken?: string | null;
  maxProcesses?: number;
}

export interface ReapRunOrphansInput extends ListRunOrphanProcessesInput {
  graceMs?: number;
  /**
   * When the existing termination path already signaled the process group
   * (timeout or terminal-output cleanup), skip the group fallback so this
   * pass does not signal a group a second time.
   */
  processGroupHandled?: boolean;
  /**
   * Permit the process-group fallback. This is opt-in because a clean run can
   * intentionally leave background infrastructure (the sandbox callback bridge
   * is one example) in the same group. Only an abnormal terminal status or an
   * explicit test should enable it.
   */
  allowProcessGroupFallback?: boolean;
  processGroupId?: number | null;
  /** Called once per pass that found matching processes. */
  onAlert?: (alert: RunOrphanReapAlert) => void;
  phase?: "terminal" | "sweep";
}

function resolvePlatform(deps: RunOrphanReaperDependencies): NodeJS.Platform {
  return deps.platform ?? process.platform;
}

function resolveProcRoot(deps: RunOrphanReaperDependencies): string {
  return deps.procRoot ?? "/proc";
}

function resolveSelfPid(deps: RunOrphanReaperDependencies): number {
  return deps.selfPid ?? process.pid;
}

function resolveUid(deps: RunOrphanReaperDependencies): number | null {
  if (deps.uid !== undefined) return deps.uid;
  return typeof process.getuid === "function" ? process.getuid() : null;
}

function resolveNow(deps: RunOrphanReaperDependencies): number {
  return (deps.now ?? Date.now)();
}

function resolveSleep(deps: RunOrphanReaperDependencies): (ms: number) => Promise<void> {
  return deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
}

function resolveKill(
  deps: RunOrphanReaperDependencies,
): (pid: number, signal: NodeJS.Signals | 0) => void {
  return deps.kill ?? ((pid, signal) => process.kill(pid, signal));
}

function writeStructuredAlert(
  alert: RunOrphanReapAlert,
  deps: RunOrphanReaperDependencies,
): void {
  const line = JSON.stringify(alert);
  try {
    (deps.writeAlert ?? ((value) => process.stderr.write(value + "\n")))(line);
  } catch {
    // An audit sink must never break cleanup.
  }
}

function unsupportedResult(reason: string): RunOrphanReapResult {
  return {
    supported: false,
    reason,
    found: 0,
    terminated: 0,
    killed: 0,
    survivors: 0,
    processes: [],
    groupTerminated: false,
    groupKilled: false,
  };
}

async function readPidNames(procRoot: string): Promise<number[]> {
  const entries = await fs.readdir(procRoot);
  const pids: number[] = [];
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number.parseInt(entry, 10);
    if (Number.isInteger(pid) && pid > 0) pids.push(pid);
  }
  pids.sort((left, right) => left - right);
  return pids;
}

interface ProcStatFields {
  pid: number;
  ppid: number;
  state: string;
  startTime: string;
}

/**
 * Parse the fields this module needs from `/proc/<pid>/stat`. The `comm` field
 * may contain spaces and parentheses, so split only after the last `)`. After
 * that suffix field 3 (`state`) is index 0 and field 22 (`starttime`) is index
 * 19.
 */
function parseProcStat(pid: number, raw: string): ProcStatFields | null {
  const closeParen = raw.lastIndexOf(")");
  if (closeParen < 0) return null;
  const rest = raw.slice(closeParen + 1).trim().split(/\s+/);
  if (rest.length < 20) return null;
  const ppid = Number.parseInt(rest[1], 10);
  if (!Number.isInteger(ppid) || ppid < 0) return null;
  const startTime = rest[19];
  if (!startTime) return null;
  return { pid, ppid, state: rest[0] ?? "?", startTime };
}

async function readProcStat(
  procRoot: string,
  pid: number,
): Promise<ProcStatFields | null> {
  try {
    return parseProcStat(pid, await fs.readFile(path.join(procRoot, String(pid), "stat"), "utf8"));
  } catch {
    return null;
  }
}

function environmentHasExactMarker(raw: Buffer, key: string, value: string): boolean {
  const marker = `${key}=${value}`;
  let offset = 0;
  while (offset <= raw.length) {
    const end = raw.indexOf(0, offset);
    const stop = end === -1 ? raw.length : end;
    if (stop - offset === marker.length) {
      let match = true;
      for (let index = 0; index < marker.length; index += 1) {
        if (raw[offset + index] !== marker.charCodeAt(index)) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    if (end === -1) break;
    offset = end + 1;
  }
  return false;
}

async function collectAncestors(
  procRoot: string,
  selfPid: number,
): Promise<Set<number>> {
  const ancestors = new Set<number>();
  let current = selfPid;
  for (let depth = 0; depth < 64; depth += 1) {
    const stat = await readProcStat(procRoot, current);
    if (!stat || stat.ppid <= 0 || stat.ppid === current) break;
    if (ancestors.has(stat.ppid)) break;
    ancestors.add(stat.ppid);
    current = stat.ppid;
  }
  return ancestors;
}

async function readCommand(procRoot: string, pid: number): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(procRoot, String(pid), "cmdline"));
    const command = redactCommandText(
      raw.toString("utf8").replace(/\0/g, " ").replace(/\s+/g, " ").trim(),
    );
    return command.slice(0, 200) || "<unknown>";
  } catch {
    return "<unknown>";
  }
}

/**
 * List processes in this PID namespace whose env carries the exact
 * `PAPERCLIP_RUN_ID=<runId>` marker. Pure read-only selection: this function
 * never signals anything. It excludes the caller and its ancestors, refuses to
 * run as root, and only considers processes owned by the same uid.
 */
export async function listRunOrphanProcesses(
  input: ListRunOrphanProcessesInput,
): Promise<{
  supported: boolean;
  reason: string | null;
  processes: RunOrphanProcessInfo[];
}> {
  if (resolvePlatform(input) !== "linux") {
    return { supported: false, reason: "the run orphan reaper requires Linux /proc", processes: [] };
  }
  const uid = resolveUid(input);
  if (uid === null) {
    return { supported: false, reason: "the current uid is unavailable", processes: [] };
  }
  if (uid === 0) {
    // Never signal from a root process: a root-owned marker scan could reach
    // processes outside the run's own uid, and the run itself is unprivileged.
    return { supported: false, reason: "refusing to reap run orphans as root", processes: [] };
  }

  const procRoot = resolveProcRoot(input);
  const selfPid = resolveSelfPid(input);
  const maxProcesses = Math.max(1, input.maxProcesses ?? DEFAULT_MAX_PROCESSES);
  const excluded = new Set<number>([selfPid]);
  for (const pid of await collectAncestors(procRoot, selfPid)) excluded.add(pid);

  let pids: number[];
  try {
    pids = await readPidNames(procRoot);
  } catch (error) {
    return {
      supported: false,
      reason: `/proc could not be listed: ${error instanceof Error ? error.message : String(error)}`,
      processes: [],
    };
  }
  const processes: RunOrphanProcessInfo[] = [];
  for (const pid of pids) {
    if (processes.length >= maxProcesses) break;
    if (pid <= 1 || excluded.has(pid)) continue;
    let ownerUid: number;
    try {
      ownerUid = (await fs.stat(path.join(procRoot, String(pid)))).uid;
    } catch {
      continue;
    }
    if (ownerUid !== uid) continue;

    const stat = await readProcStat(procRoot, pid);
    // A zombie has no runnable state and no env left to reap. Skip it rather
    // than counting it as a survivor forever.
    if (!stat || stat.state === "Z" || stat.state === "X") continue;

    let environ: Buffer;
    try {
      environ = await fs.readFile(path.join(procRoot, String(pid), "environ"));
    } catch {
      continue;
    }
    if (!environmentHasExactMarker(environ, "PAPERCLIP_RUN_ID", input.runId)) continue;
    if (
      input.processToken &&
      !environmentHasExactMarker(environ, "PAPERCLIP_RUN_PROCESS_TOKEN", input.processToken)
    ) {
      continue;
    }

    processes.push({
      pid,
      ppid: stat.ppid,
      startTime: stat.startTime,
      command: await readCommand(procRoot, pid),
    });
  }
  return { supported: true, reason: null, processes };
}

function pidOrderValue(pid: number): number {
  return pid > 0 ? pid : Number.MAX_SAFE_INTEGER;
}

function signalOne(
  pid: number,
  signal: NodeJS.Signals,
  kill: (pid: number, signal: NodeJS.Signals | 0) => void,
): boolean {
  if (pid <= 1) return false;
  try {
    kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function pidGroupAlive(
  processGroupId: number,
  kill: (pid: number, signal: NodeJS.Signals | 0) => void,
): boolean {
  if (processGroupId <= 1) return false;
  try {
    kill(-processGroupId, 0);
    return true;
  } catch {
    return false;
  }
}

function signalProcessGroup(
  processGroupId: number,
  signal: NodeJS.Signals,
  selfPid: number,
  kill: (pid: number, signal: NodeJS.Signals | 0) => void,
): boolean {
  // A negative PID names a process group. Refuse our own group and PID 1's.
  if (processGroupId <= 1 || processGroupId === selfPid) return false;
  try {
    kill(-processGroupId, signal);
    return true;
  } catch {
    return false;
  }
}

function buildAlert(
  runId: string,
  processes: RunOrphanProcessInfo[],
  phase: "terminal" | "sweep",
  processGroupId: number | null = null,
): RunOrphanReapAlert {
  const unique = new Map<number, RunOrphanProcessInfo>();
  for (const process of processes) unique.set(process.pid, process);
  const values = [...unique.values()].sort((left, right) => pidOrderValue(left.pid) - pidOrderValue(right.pid));
  return {
    event: RUN_ORPHAN_REAPER_ALERT_EVENT,
    metric: RUN_ORPHAN_REAPER_METRIC,
    runId,
    count: values.length,
    pids: values.map((value) => value.pid),
    commands: values.map((value) => value.command),
    phase,
    ...(processGroupId !== null ? { processGroupId } : {}),
  };
}

/**
 * Run one bounded reap loop: select, SIGTERM, wait the grace window, re-scan
 * (the second pass also catches a descendant that forked during the wait), then
 * SIGKILL whatever still carries the marker. Idempotent: a repeated call simply
 * finds nothing once the previous call finished.
 */
export async function reapRunOrphans(
  input: ReapRunOrphansInput,
): Promise<RunOrphanReapResult> {
  const graceMs = Math.max(0, input.graceMs ?? DEFAULT_GRACE_MS);
  const kill = resolveKill(input);
  const sleep = resolveSleep(input);
  const selfPid = resolveSelfPid(input);
  const procRoot = resolveProcRoot(input);
  const uid = resolveUid(input);
  const phase = input.phase ?? "terminal";

  const first = await listRunOrphanProcesses(input);
  if (!first.supported) return unsupportedResult(first.reason ?? "unsupported");

  const discovered = new Map<number, RunOrphanProcessInfo>();
  const record = (processes: RunOrphanProcessInfo[]) => {
    const added: RunOrphanProcessInfo[] = [];
    for (const process of processes) {
      if (discovered.has(process.pid)) continue;
      discovered.set(process.pid, process);
      added.push(process);
    }
    return added;
  };

  const initial = first.processes;
  const initialAdded = record(initial);
  let terminated = 0;
  if (initialAdded.length > 0) {
    const alert = buildAlert(input.runId, initialAdded, phase);
    writeStructuredAlert(alert, input);
    input.onAlert?.(alert);
    for (const process of initialAdded) {
      if (!(await processStillMatches(input, process, procRoot, uid))) continue;
      if (signalOne(process.pid, "SIGTERM", kill)) terminated += 1;
    }
  }

  // The process-group fallback covers a descendant that cleared its environment
  // (`env -i`) but stayed in the run's process group. It is opt-in because a
  // clean run can intentionally leave background infrastructure in the group.
  let groupTerminated = false;
  let groupKilled = false;
  const processGroupId = input.processGroupId ?? null;
  if (
    input.allowProcessGroupFallback === true &&
    !input.processGroupHandled &&
    processGroupId !== null &&
    processGroupId > 1 &&
    processGroupId !== selfPid &&
    !(await collectAncestors(procRoot, selfPid)).has(processGroupId) &&
    pidGroupAlive(processGroupId, kill)
  ) {
    groupTerminated = signalProcessGroup(processGroupId, "SIGTERM", selfPid, kill);
    if (groupTerminated && discovered.size === 0) {
      const alert = buildAlert(input.runId, [], phase, processGroupId);
      writeStructuredAlert(alert, input);
      input.onAlert?.(alert);
    }
  }

  if (initial.length > 0 || groupTerminated) {
    await sleep(graceMs);
  }

  const second = await listRunOrphanProcesses(input);
  const live = second.supported ? second.processes : [];
  const secondAdded = record(live);
  if (secondAdded.length > 0) {
    // A descendant that forked during the grace window was not in the first
    // alert. Record it before the SIGKILL escalation so the audit log covers
    // every process this pass stopped.
    const alert = buildAlert(input.runId, secondAdded, phase);
    writeStructuredAlert(alert, input);
    input.onAlert?.(alert);
  }
  let killed = 0;
  for (const process of live) {
    // Recheck uid, marker, and start time immediately before the signal so a
    // recycled PID is never killed on the strength of the earlier scan.
    if (!(await processStillMatches(input, process, procRoot, uid))) continue;
    if (signalOne(process.pid, "SIGKILL", kill)) killed += 1;
  }
  if (groupTerminated && pidGroupAlive(processGroupId as number, kill)) {
    groupKilled = signalProcessGroup(processGroupId as number, "SIGKILL", selfPid, kill);
  }

  if (killed > 0) await sleep(STAT_SETTLE_MS);

  const final = await listRunOrphanProcesses(input);
  const survivors = final.supported ? final.processes.length : 0;

  return {
    supported: true,
    reason: null,
    found: discovered.size,
    terminated,
    killed,
    survivors,
    processes: [...discovered.values()],
    groupTerminated,
    groupKilled,
  };
}

async function processStillMatches(
  input: ListRunOrphanProcessesInput,
  process: RunOrphanProcessInfo,
  procRoot: string,
  uid: number | null,
): Promise<boolean> {
  if (uid === null) return false;
  const stat = await readProcStat(procRoot, process.pid);
  if (!stat || stat.state === "Z" || stat.state === "X") return false;
  if (stat.startTime !== process.startTime) return false;
  try {
    if ((await fs.stat(path.join(procRoot, String(process.pid)))).uid !== uid) return false;
    const environ = await fs.readFile(path.join(procRoot, String(process.pid), "environ"));
    if (!environmentHasExactMarker(environ, "PAPERCLIP_RUN_ID", input.runId)) return false;
    if (
      input.processToken &&
      !environmentHasExactMarker(environ, "PAPERCLIP_RUN_PROCESS_TOKEN", input.processToken)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

interface RecentTerminalRun {
  runId: string;
  processToken: string | null;
  graceMs: number;
  expiresAt: number;
  /** `${pid}:${startTime}` seen and signaled on an earlier sweep. */
  signaled: Map<string, number>;
  alertedPids: Set<number>;
}

let unavailableReported = false;

function reportRunOrphanReaperUnavailable(reason: string): void {
  if (unavailableReported) return;
  unavailableReported = true;
  try {
    process.stderr.write(
      JSON.stringify({
        event: "run_orphan_reaper_unavailable",
        level: "warn",
        reason,
      }) + "\n",
    );
  } catch {
    // A diagnostic sink must never break the run path.
  }
}

const recentTerminalRuns = new Map<string, RecentTerminalRun>();
let sweepTimer: NodeJS.Timeout | null = null;
let sweepInFlight: Promise<unknown> | null = null;
let reaperStopping = false;

function readPositiveEnvMs(name: string, fallback: number): number {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function sweepWindowMs(): number {
  return readPositiveEnvMs("PAPERCLIP_RUN_ORPHAN_SWEEP_WINDOW_MS", DEFAULT_SWEEP_WINDOW_MS);
}

function sweepIntervalMs(): number {
  return readPositiveEnvMs("PAPERCLIP_RUN_ORPHAN_SWEEP_INTERVAL_MS", DEFAULT_SWEEP_INTERVAL_MS);
}

function ensureSweepTimer(deps: RunOrphanReaperDependencies): void {
  if (reaperStopping || sweepTimer || recentTerminalRuns.size === 0) return;
  sweepTimer = setInterval(() => {
    if (reaperStopping || sweepInFlight) return;
    const run = sweepRecentlyTerminalRuns(resolveNow(deps), deps).catch(() => undefined);
    sweepInFlight = run;
    void run.finally(() => {
      if (sweepInFlight === run) sweepInFlight = null;
    });
  }, sweepIntervalMs());
  sweepTimer.unref?.();
}

function stopSweepTimerIfIdle(): void {
  if (recentTerminalRuns.size > 0 || !sweepTimer) return;
  clearInterval(sweepTimer);
  sweepTimer = null;
}

/**
 * Register a terminal run for the bounded periodic sweep. The window is short
 * on purpose: it catches a delayed fork without turning the server into a
 * permanent process scanner.
 */
export function registerRecentTerminalRun(input: {
  runId: string;
  processToken?: string | null;
  graceMs?: number;
  windowMs?: number;
  now?: number;
}): void {
  const now = input.now ?? Date.now();
  const windowMs = Math.max(1, input.windowMs ?? sweepWindowMs());
  recentTerminalRuns.delete(input.runId);
  recentTerminalRuns.set(input.runId, {
    runId: input.runId,
    processToken: input.processToken ?? null,
    graceMs: Math.max(0, input.graceMs ?? DEFAULT_GRACE_MS),
    expiresAt: now + windowMs,
    signaled: new Map(),
    alertedPids: new Set(),
  });
  // Bounded registry: drop the oldest entries instead of growing without limit.
  while (recentTerminalRuns.size > DEFAULT_MAX_RECENT_RUNS) {
    const oldest = recentTerminalRuns.keys().next().value;
    if (oldest === undefined) break;
    recentTerminalRuns.delete(oldest);
  }
  ensureSweepTimer({});
}

export interface SweepRunOrphanResult {
  scanned: number;
  found: number;
  terminated: number;
  killed: number;
}

/**
 * One bounded sweep over the recently terminal runs this process still tracks.
 * A run is removed once its window expires, so the sweep cost stays bounded by
 * the number of recent terminal runs (at most 64) times the per-run PID cap.
 */
export async function sweepRecentlyTerminalRuns(
  now = Date.now(),
  deps: RunOrphanReaperDependencies = {},
): Promise<SweepRunOrphanResult> {
  const result: SweepRunOrphanResult = { scanned: 0, found: 0, terminated: 0, killed: 0 };
  const kill = resolveKill(deps);

  for (const [runId, entry] of [...recentTerminalRuns.entries()]) {
    if (now >= entry.expiresAt) {
      recentTerminalRuns.delete(runId);
      continue;
    }
    result.scanned += 1;

    const listed = await listRunOrphanProcesses({
      ...deps,
      runId,
      processToken: entry.processToken,
      maxProcesses: DEFAULT_MAX_PROCESSES,
    });
    if (listed.supported && listed.processes.length > 0) {
      result.found += listed.processes.length;
      const newAlerts = listed.processes.filter((process) => !entry.alertedPids.has(process.pid));
      if (newAlerts.length > 0) {
        for (const process of listed.processes) entry.alertedPids.add(process.pid);
        const alert = buildAlert(runId, newAlerts, "sweep");
        writeStructuredAlert(alert, deps);
      }
      for (const process of listed.processes) {
        const key = `${process.pid}:${process.startTime}`;
        const signaledAt = entry.signaled.get(key);
        const signal = signaledAt === undefined ? "SIGTERM" : now - signaledAt >= entry.graceMs ? "SIGKILL" : null;
        if (!signal) continue;
        // Recheck the marker, uid, and start time immediately before the
        // signal. The list above can be stale if a selected process exited and
        // its number was reused during the scan.
        if (
          !(await processStillMatches(
            { ...deps, runId, processToken: entry.processToken },
            process,
            resolveProcRoot(deps),
            resolveUid(deps),
          ))
        ) {
          continue;
        }
        if (signal === "SIGTERM") {
          if (signalOne(process.pid, signal, kill)) {
            entry.signaled.set(key, now);
            result.terminated += 1;
          }
        } else if (signalOne(process.pid, signal, kill)) {
          entry.signaled.delete(key);
          result.killed += 1;
        }
      }
    }
  }

  stopSweepTimerIfIdle();
  return result;
}

/**
 * The integration point used by `runChildProcess`: reap now, then keep a short
 * bounded sweep alive for delayed forks. This runs for every terminal status,
 * including a clean exit, so a successful run that left an orphan is covered.
 */
export async function reapRunOrphansForTerminalRun(input: {
  runId: string;
  processToken?: string | null;
  processGroupId?: number | null;
  graceMs?: number;
  processGroupHandled?: boolean;
  allowProcessGroupFallback?: boolean;
}): Promise<RunOrphanReapResult> {
  const graceMs = Math.max(0, input.graceMs ?? DEFAULT_GRACE_MS);
  const result = await reapRunOrphans({
    runId: input.runId,
    processToken: input.processToken ?? null,
    processGroupId: input.processGroupId ?? null,
    graceMs,
    processGroupHandled: input.processGroupHandled === true,
    allowProcessGroupFallback: input.allowProcessGroupFallback === true,
    phase: "terminal",
  });
  // A platform that cannot scan has nothing for a later sweep to find, and a
  // periodic pass would only repeat the same unsupported result. Report the
  // gap once instead of keeping a false green alive for the sweep window.
  if (!result.supported) {
    reportRunOrphanReaperUnavailable(result.reason ?? "unsupported");
    return result;
  }
  registerRecentTerminalRun({
    runId: input.runId,
    processToken: input.processToken ?? null,
    graceMs,
  });
  return result;
}

/** Clears the sweep registry and timer. Intended for tests only. */
export function resetRunOrphanReaperForTests(): void {
  recentTerminalRuns.clear();
  unavailableReported = false;
  reaperStopping = false;
  sweepInFlight = null;
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}

/**
 * Host lifecycle hook. The server calls this during orderly shutdown so no new
 * sweep starts and an in-flight sweep is awaited before the process exits.
 */
export async function stopRunOrphanReaper(): Promise<void> {
  reaperStopping = true;
  recentTerminalRuns.clear();
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
  const inFlight = sweepInFlight;
  if (inFlight) await inFlight.catch(() => undefined);
}

/** Resumes sweeps after a test-only stop. */
export function resumeRunOrphanReaperForTests(): void {
  reaperStopping = false;
}
