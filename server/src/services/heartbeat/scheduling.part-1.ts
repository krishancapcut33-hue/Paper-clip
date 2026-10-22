import { randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import {
  activityLog, agents, agentSessionGoalActions, agentTaskSessions, companies, createDb,
  completionContracts, EMBEDDED_POSTGRES_TEST_TIMEOUT_MS, heartbeatRuns, issueComments, issues, nativeRunFinalizations, nativeRunResults,
} from "@paperclipai/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "../../__tests__/helpers/embedded-postgres.js";
import { conflict } from "../../errors.js";
import { createHeartbeatRunPreparation } from "./run-preparation.js";
import { createHeartbeatRunState } from "./run-state.js";
import { createHeartbeatScheduling, type HeartbeatSchedulingDependencies } from "./scheduling.js";
import { readIdleSleepSafety } from "../idle-sleep-safety.js";
import { PaperclipRunnerToolAuthority } from "../native-runtime/paperclip-runner-tool-authority.js";
import { finalizeNativeRun } from "../native-runtime/native-run-finalizer.js";
import { nativeCompletionFeedback } from "../native-runtime/native-completion-feedback.js";
import type { PrpStructuredRunResult } from "../../vendor/paperclip-runner/index.js";
vi.mock("../live-events.js", () => ({ publishLiveEvent: vi.fn() }));
type Run = typeof heartbeatRuns.$inferSelect;
const now = new Date("2026-10-09T12:00:00.000Z");
const dueAt = new Date(now.getTime() - 60_000);
const admitted = { id: "admitted-run" } as Run;
const timerPolicy = {
  enabled: false, intervalSec: 60, wakeOnDemand: true, maxConcurrentRuns: 1,
  skipTimerWhenNoActionableWork: false, maxDailyRuns: null, maxDailyCostCents: null,
};
function callbacks(db: Db) {
  const state = createHeartbeatRunState(db);
  const preparation = createHeartbeatRunPreparation(db);
  return {
    getAgent: state.getAgent,
    getRun: state.getRun,
    toAgentOrgRow: preparation.toAgentOrgRow,
    groupAgentOrgRowsByCompany: preparation.groupAgentOrgRowsByCompany,
    issuesSvc: {
      listReviewAttention: vi.fn<HeartbeatSchedulingDependencies["issuesSvc"]["listReviewAttention"]>(async () => new Map()),
      create: vi.fn<HeartbeatSchedulingDependencies["issuesSvc"]["create"]>(),
    },
    enqueueWakeup: vi.fn<HeartbeatSchedulingDependencies["enqueueWakeup"]>(async () => admitted),
    scheduleBoundedRetryForRun: vi.fn<HeartbeatSchedulingDependencies["scheduleBoundedRetryForRun"]>(),
    getSchedulingSuppression: vi.fn(async () => ({ suppressed: false })),
    getWorktreeExecutionCutoff: vi.fn<HeartbeatSchedulingDependencies["getWorktreeExecutionCutoff"]>(async () => null),
    parseHeartbeatPolicy: vi.fn<HeartbeatSchedulingDependencies["parseHeartbeatPolicy"]>(() => timerPolicy),
    claimDueTimerHeartbeat: vi.fn<HeartbeatSchedulingDependencies["claimDueTimerHeartbeat"]>(async () => ({ wasFirstHeartbeat: true })),
  } satisfies HeartbeatSchedulingDependencies;
}
const postgres = await getEmbeddedPostgresTestSupport();
describe("heartbeat scheduling module boundary", () => {
function guardedDatabase() {
    const access = vi.fn(() => { throw new Error("Unexpected scheduling database access"); });
    return { db: new Proxy({}, { get: access }) as Db, access };
  }
it("constructs without querying, admitting work, or starting timers", () => {
    const database = guardedDatabase();
    const deps = callbacks(database.db);
    createHeartbeatScheduling(database.db, deps);
    expect(database.access).not.toHaveBeenCalled();
    for (const callback of Object.values(deps)) if (vi.isMockFunction(callback)) expect(callback).not.toHaveBeenCalled();
  });
it.each(["tickTimers", "recoverActiveSessionGoals", "recoverPendingSessionGoalActions"] as const)(
    "honors suppression before %s reads or admits work", async (operation) => {
      const database = guardedDatabase();
      const deps = callbacks(database.db);
      deps.getSchedulingSuppression.mockResolvedValue({ suppressed: true });
      const result = await createHeartbeatScheduling(database.db, deps)[operation]();
      expect(Object.values(result).every(value => value === 0)).toBe(true);
      expect(database.access).not.toHaveBeenCalled();
      expect(deps.enqueueWakeup).not.toHaveBeenCalled();
      expect(deps.claimDueTimerHeartbeat).not.toHaveBeenCalled();
    },
  );
});
