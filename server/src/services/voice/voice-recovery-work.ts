import { takeCompanyWorkBatch } from "../company-work-batch.js";
import type { createDeliveryWorkCoordinator } from "../delivery-work-coordinator.js";
import { DELIVERY_QUEUES } from "../delivery-work-notifications.js";
import type { VoiceRecoveryEntry, voiceSessionRecovery } from "./voice-session-recovery.js";
import { voiceRecoveryScope, type VoiceRecoveryScope } from "./voice-recovery-notifications.js";

function matches(entry: VoiceRecoveryEntry, scope?: VoiceRecoveryScope) {
  return !scope || (scope.kind === "session" ? entry.id : scope.kind === "endpoint" ? entry.endpointId : scope.kind === "connection" ? entry.connectionId : entry.companyId) === scope.id;
}
export function registerVoiceRecoveryWork(
  coordinator: ReturnType<typeof createDeliveryWorkCoordinator>,
  service: ReturnType<typeof voiceSessionRecovery>,
  canRun: () => boolean,
) {
  service.reset();
  const dirty = new Set<string>(["*"]);
  const versions = new Map<string, number>();
  const scans = new Map<string, { version: number; seen: Set<string> }>();
  const entries = new Map<string, VoiceRecoveryEntry>();
  const failures = new Map<string, { count: number; retryAt: number }>();
  const scopeFailures = new Map<string, { count: number; retryAt: number }>();
  let earliest = 0;
  let lastCompany: string | null = null;
  function failed(map: typeof failures, id: string) {
    const count = Math.min((map.get(id)?.count ?? 0) + 1, 5);
    map.set(id, { count, retryAt: Date.now() + Math.min(300_000, 30_000 * 2 ** (count - 1)) });
  }
  function dirtyScopes() {
    return [...dirty].filter(hint => hint !== "*" || !scopeFailures.has(hint))
      .filter(hint => !scans.has(hint) || scopeFailures.has(hint))
      .map(hint => { try { return voiceRecoveryScope(hint); } catch { return undefined; } });
  }
  function next() {
    let nextAt: number | null = null;
    const take = (at: number) => { nextAt = nextAt === null ? at : Math.min(nextAt, at); };
    for (const hint of dirty) take(Math.max(earliest, scopeFailures.get(hint)?.retryAt ?? 0));
    const unavailable = dirtyScopes();
    for (const entry of entries.values()) if (!unavailable.some(scope => matches(entry, scope)))
      take(Math.max(earliest, entry.dueAt, failures.get(entry.id)?.retryAt ?? 0));
    return nextAt;
  }
  const worker = coordinator.register(DELIVERY_QUEUES.voiceSessionRecovery, {
    retryMs: 30_000,
    pausePassiveMaintenance: true,
    onSettled: hints => { for (const hint of hints ?? ["*"]) {
      dirty.add(hint); versions.set(hint, (versions.get(hint) ?? 0) + 1);
    } },
    run: async signal => {
      if (!canRun() || Date.now() < earliest) return;
      earliest = Date.now() + 1000;
      const errors: unknown[] = [];
      const ready = [...dirty].filter(hint => (scopeFailures.get(hint)?.retryAt ?? 0) <= Date.now());
      const requested = ready.includes("*")
        ? ["*", ...ready.filter(hint => hint !== "*")].slice(0, 25)
        : ready.slice(0, 25);
      for (const hint of requested) dirty.delete(hint);
      for (let index = 0; index < requested.length; index++) {
        if (signal.aborted || !canRun()) { for (const hint of requested.slice(index)) dirty.add(hint); return; }
        const hint = requested[index];
        let scope: VoiceRecoveryScope | undefined;
        let decoded = false;
        try {
          scope = voiceRecoveryScope(hint); decoded = true;
          const scan = scans.get(hint) ?? { version: versions.get(hint) ?? 0, seen: new Set<string>() };
          scans.set(hint, scan);
          const result = await service.refresh(scope, signal);
          for (const entry of result.rows ?? []) {
            entries.set(entry.id, entry);
            for (const [other, progress] of scans) if (matches(entry, voiceRecoveryScope(other))) progress.seen.add(entry.id);
          }
          if (!result.complete) { dirty.add(hint); continue; }
          if (result.rows !== null) for (const entry of entries.values()) if (matches(entry, scope) && !scan.seen.has(entry.id)) {
            entries.delete(entry.id); failures.delete(entry.id);
          }
          scans.delete(hint);
          if ((versions.get(hint) ?? 0) !== scan.version) dirty.add(hint); else versions.delete(hint);
          if (!scope) scopeFailures.clear(); else scopeFailures.delete(hint);
        } catch (error) {
          const retryHint = decoded ? hint : "*";
          if (!decoded) { scans.delete(hint); versions.delete(hint); }
          dirty.add(retryHint); failed(scopeFailures, retryHint); errors.push(error);
        }
      }
      const unavailable = dirtyScopes();
      const due = [...entries.values()].filter(entry => !unavailable.some(scope => matches(entry, scope))
        && Math.max(entry.dueAt, failures.get(entry.id)?.retryAt ?? 0) <= Date.now())
        .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
      const batch = takeCompanyWorkBatch(due, 25, lastCompany); lastCompany = batch.lastCompany;
      for (const entry of batch.entries) {
        if (signal.aborted || !canRun()) break;
        try {
          const current = await service.check(entry.id, signal);
          if (current) entries.set(entry.id, current); else entries.delete(entry.id);
          failures.delete(entry.id);
        } catch (error) { failed(failures, entry.id); errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "Voice session recovery could not settle");
    },
    // Retain scopes/deadlines for resume without retaining a settled write's
    // idle hold during drain. The coordinator still fences unresolved XIDs.
    hasPending: async () => canRun() && dirty.size > 0,
    nextRunAt: next,
    nextRunAtOnError: next,
  });
  return worker;
}
