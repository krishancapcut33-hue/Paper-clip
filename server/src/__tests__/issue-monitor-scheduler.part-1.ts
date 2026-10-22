import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PROVIDER_QUOTA_MONITOR_SERVICE_NAME } from "@paperclipai/shared";
import {
  costEvents,
  activityLog,
  agentRuntimeState,
  agentWakeupRequests,
  agents,
  companies,
  companySkills,
  createDb,
  documentRevisions,
  documents,
  environmentLeases,
  heartbeatRunEvents,
  heartbeatRuns,
  issueComments,
  issueRecoveryActions,
  issueDocuments,
  issues,
  workspaceRuntimeServices,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { heartbeatService } from "../services/heartbeat.ts";
import { normalizeIssueExecutionPolicy, parseIssueExecutionState } from "../services/issue-execution-policy.ts";
import { PaperclipRunnerToolAuthority } from "../services/native-runtime/paperclip-runner-tool-authority.js";
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres issue monitor scheduler tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}
describeEmbeddedPostgres("issue monitor scheduler", () => {
let db!: ReturnType<typeof createDb>;
let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
const seededAgentIds = new Set<string>();
beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-issue-monitor-");
    db = createDb(tempDb.connectionString);
  }, 20_000);
async function waitForHeartbeatIdle(timeoutMs = 3_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const active = await db
        .select({ id: heartbeatRuns.id })
        .from(heartbeatRuns)
        .where(sql`${heartbeatRuns.status} in ('queued', 'running', 'scheduled_retry')`);
      if (active.length === 0) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for issue monitor heartbeat runs to settle");
  }
async function heartbeatSideEffectFingerprint() {
    const [active, events, activity, leases, runtimeServices] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(heartbeatRuns)
        .where(sql`${heartbeatRuns.status} in ('queued', 'running', 'scheduled_retry')`),
      db.select({ count: sql<number>`count(*)` }).from(heartbeatRunEvents),
      db.select({ count: sql<number>`count(*)` }).from(activityLog),
      db.select({ count: sql<number>`count(*)` }).from(environmentLeases),
      db.select({ count: sql<number>`count(*)` }).from(workspaceRuntimeServices),
    ]);

    return [
      active[0]?.count ?? 0,
      events[0]?.count ?? 0,
      activity[0]?.count ?? 0,
      leases[0]?.count ?? 0,
      runtimeServices[0]?.count ?? 0,
    ].join(":");
  }
async function waitForHeartbeatSideEffectsSettled(timeoutMs = 5_000, quietMs = 500) {
    const deadline = Date.now() + timeoutMs;
    let previous = "";
    let stableSince = Date.now();
    while (Date.now() < deadline) {
      const current = await heartbeatSideEffectFingerprint();
      const activeCount = Number(current.split(":")[0] ?? 0);
      if (current !== previous || activeCount > 0) {
        previous = current;
        stableSince = Date.now();
      } else if (Date.now() - stableSince >= quietMs) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for issue monitor heartbeat side effects to settle");
  }
async function cleanupRows() {
    await waitForHeartbeatSideEffectsSettled();
    await db.delete(heartbeatRunEvents);
    await db.delete(issueRecoveryActions);
    await db.delete(issueComments);
    await db.delete(documentRevisions);
    await db.delete(issueDocuments);
    await db.delete(documents);
    await db.delete(activityLog);
    await db.delete(environmentLeases);
    await db.delete(workspaceRuntimeServices);
    await db.delete(issues);
    await db.delete(costEvents);
    await db.delete(heartbeatRuns);
    await db.delete(agentWakeupRequests);
    await db.delete(agentRuntimeState);
    await db.delete(agents);
    await db.delete(companySkills);
    await db.delete(companies);
  }
afterEach(async () => {
                                                                             
                                                                         
                                                                           
    const heartbeat = heartbeatService(db);
    await heartbeat.drainActiveRunExecutions();
    const pending = await db.select({ id: heartbeatRuns.id }).from(heartbeatRuns)
      .where(sql`${heartbeatRuns.status} in ('queued', 'running', 'scheduled_retry')`);
    for (const run of pending) await heartbeat.cancelRun(run.id, "Monitor fixture teardown", { suppressImmediateRecovery: true });
    await heartbeat.drainActiveRunExecutions();
    seededAgentIds.clear();
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await cleanupRows();
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw lastError;
  });
afterAll(async () => {
    await tempDb?.cleanup();
  });
async function seedFixture(input?: {
    agentStatus?: "active" | "paused";
    issueStatus?: "in_progress" | "in_review";
    monitorAttemptCount?: number;
    monitor?: Record<string, unknown>;
  }) {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const issueId = randomUUID();
    const nextCheckAt = new Date("2026-04-11T12:30:00.000Z");
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    const monitorAttemptCount = input?.monitorAttemptCount ?? 0;
    const monitor = {
      nextCheckAt: nextCheckAt.toISOString(),
      notes: "Check deploy",
      scheduledBy: "assignee",
      ...(input?.monitor ?? {}),
    };

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
      defaultResponsibleUserId: "responsible-user",
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Monitor Bot",
      role: "engineer",
      status: input?.agentStatus ?? "active",
      adapterType: "process",
      adapterConfig: {
        command: process.execPath,
        args: ["-e", ""],
        cwd: process.cwd(),
      },
      runtimeConfig: {
        heartbeat: {
          enabled: false,
          wakeOnDemand: true,
        },
      },
      permissions: {},
    });
    seededAgentIds.add(agentId);

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Watch external deploy",
      status: input?.issueStatus ?? "in_progress",
      priority: "medium",
      assigneeAgentId: agentId,
      issueNumber: 1,
      identifier: `${issuePrefix}-1`,
      executionPolicy: {
        mode: "normal",
        commentRequired: true,
        stages: [],
        monitor,
      },
      executionState: {
        status: "idle",
        currentStageId: null,
        currentStageIndex: null,
        currentStageType: null,
        currentParticipant: null,
        returnAssignee: null,
        completedStageIds: [],
        lastDecisionId: null,
        lastDecisionOutcome: null,
        monitor: {
          status: "scheduled",
          nextCheckAt: nextCheckAt.toISOString(),
          lastTriggeredAt: null,
          attemptCount: monitorAttemptCount,
          notes: "Check deploy",
          scheduledBy: "assignee",
          serviceName: typeof monitor.serviceName === "string" ? monitor.serviceName : null,
          externalRef: typeof monitor.externalRef === "string" ? monitor.externalRef : null,
          timeoutAt: typeof monitor.timeoutAt === "string" ? monitor.timeoutAt : null,
          maxAttempts: typeof monitor.maxAttempts === "number" ? monitor.maxAttempts : null,
          recoveryPolicy: typeof monitor.recoveryPolicy === "string" ? monitor.recoveryPolicy : null,
          clearedAt: null,
          clearReason: null,
        },
      },
      monitorNextCheckAt: nextCheckAt,
      monitorAttemptCount,
      monitorNotes: "Check deploy",
      monitorScheduledBy: "assignee",
    });

    return { companyId, agentId, issueId, nextCheckAt };
  }
it("triggers due issue monitors once and clears the one-shot schedule", async () => {
    const { issueId, agentId } = await seedFixture();
    const heartbeat = heartbeatService(db);
    const tickAt = new Date("2026-04-11T12:31:00.000Z");
    const [before] = await db.select().from(issues).where(eq(issues.id, issueId));
    const unrelatedPolicy = { commentRequired: false, futureAuthorization: { preserve: true } };
    await db.update(issues).set({ executionPolicy: { ...before.executionPolicy, ...unrelatedPolicy } }).where(eq(issues.id, issueId));

    const result = await heartbeat.tickTimers(tickAt);

    expect(result.enqueued).toBe(1);

    const issue = await db.select().from(issues).where(eq(issues.id, issueId)).then((rows) => rows[0]!);
    expect(issue.monitorNextCheckAt).toBeNull();
    expect(issue.executionPolicy).toMatchObject(unrelatedPolicy);
    expect(issue.monitorAttemptCount).toBe(1);
    expect(issue.monitorLastTriggeredAt?.toISOString()).toBe(tickAt.toISOString());
    expect(normalizeIssueExecutionPolicy(issue.executionPolicy ?? null)?.monitor ?? null).toBeNull();
    expect(parseIssueExecutionState(issue.executionState)?.monitor).toMatchObject({
      status: "triggered",
      lastTriggeredAt: tickAt.toISOString(),
      attemptCount: 1,
    });

    const wakeup = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.agentId, agentId))
      .then((rows) => rows[0] ?? null);
    expect(wakeup?.reason).toBe("issue_monitor_due");

    const activity = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.entityId, issueId))
      .then((rows) => rows.map((row) => row.action));
    expect(activity).toContain("issue.monitor_triggered");
  });
it("preserves a due monitor through native execution and dispatches once after release", async () => {
    const { companyId, issueId, agentId, nextCheckAt } = await seedFixture();
    const runId = randomUUID();
    await db.insert(heartbeatRuns).values({ id: runId, companyId, agentId, nativeIssueId: issueId,
      runtimeMode: "native", status: "running", contextSnapshot: { issueId } });
    await db.update(issues).set({ executionRunId: runId }).where(eq(issues.id, issueId));
    const heartbeat = heartbeatService(db);
    expect((await heartbeat.tickTimers(new Date("2026-04-11T12:31:00.000Z"))).enqueued).toBe(0);
    const [waiting] = await db.select().from(issues).where(eq(issues.id, issueId));
    expect(waiting.monitorNextCheckAt).toEqual(nextCheckAt);
    expect(waiting.monitorWakeRequestedAt).toBeNull();
    expect(await db.select().from(agentWakeupRequests)).toHaveLength(0);
    await db.update(heartbeatRuns).set({ status: "succeeded", finishedAt: new Date() }).where(eq(heartbeatRuns.id, runId));
    await db.update(issues).set({ executionRunId: null }).where(eq(issues.id, issueId));
    expect((await heartbeat.tickTimers(new Date("2026-04-11T12:32:00.000Z"))).enqueued).toBe(1);
    expect((await heartbeat.tickTimers(new Date("2026-04-11T12:33:00.000Z"))).enqueued).toBe(0);
    const [triggered] = await db.select().from(issues).where(eq(issues.id, issueId));
    expect(triggered.monitorNextCheckAt).toBeNull();
    expect(triggered.monitorAttemptCount).toBe(1);
    expect((await db.select().from(agentWakeupRequests)).filter(wake => wake.reason === "issue_monitor_due")).toHaveLength(1);
  });
it("explains held monitor dispatch without replaying uncertain execution", async () => {
    const { companyId, issueId, agentId, nextCheckAt } = await seedFixture();
    const sourceRunId = randomUUID();
    await db.insert(heartbeatRuns).values({ id: sourceRunId, companyId, agentId,
      runtimeMode: "legacy", status: "interrupted", errorCode: "process_lost",
      finishedAt: new Date(), contextSnapshot: { issueId } });
    const [hold] = await db.insert(issueRecoveryActions).values({ companyId, sourceIssueId: issueId,
      kind: "active_run_watchdog", status: "active", ownerType: "board",
      cause: "legacy_execution_requires_reconciliation", fingerprint: sourceRunId,
      evidence: { runId: sourceRunId }, nextAction: "Inspect the interrupted execution before continuing." }).returning();
    const heartbeat = heartbeatService(db);
    const tickAt = new Date("2026-04-11T12:31:00.000Z");
    expect((await heartbeat.tickTimers(tickAt)).enqueued).toBe(0);
    expect((await heartbeat.tickTimers(new Date(tickAt.getTime() + 30_000))).enqueued).toBe(0);
    const [waiting] = await db.select().from(issues).where(eq(issues.id, issueId));
    expect(waiting.monitorNextCheckAt).toEqual(nextCheckAt);
    expect(waiting.monitorWakeRequestedAt).toBeNull();
    expect(waiting.monitorAttemptCount).toBe(0);
    expect(await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.agentId, agentId))).toHaveLength(1);
    const diagnostics = (await db.select().from(activityLog).where(eq(activityLog.entityId, issueId)))
      .filter(row => row.action === "issue.monitor_deferred");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.details).toMatchObject({ nextCheckAt: nextCheckAt.toISOString(),
      reason: "execution_reconciliation_required", blockerCause: "legacy_execution_requires_reconciliation", attemptCount: 0 });
    expect((await db.select().from(issueRecoveryActions).where(eq(issueRecoveryActions.id, hold!.id)))[0]?.status).toBe("active");
    await db.update(issueRecoveryActions).set({ status: "resolved", resolvedAt: new Date(),
      evidence: { runId: sourceRunId, executionReconciliation: { action: "continue" } } }).where(eq(issueRecoveryActions.id, hold!.id));
    expect((await heartbeat.tickTimers(new Date(tickAt.getTime() + 60_000))).enqueued).toBe(1);
    expect((await heartbeat.tickTimers(new Date(tickAt.getTime() + 90_000))).enqueued).toBe(0);
    const [triggered] = await db.select().from(issues).where(eq(issues.id, issueId));
    expect(triggered.monitorAttemptCount).toBe(1);
    expect(triggered.monitorNextCheckAt).toBeNull();
  });
it("recovers a rejected native monitor call and delivers the corrected schedule once", async () => {
    const { companyId, issueId, agentId } = await seedFixture();
    const runId = randomUUID();
    await db.insert(heartbeatRuns).values({ id: runId, companyId, agentId, nativeIssueId: issueId,
      runtimeMode: "native", status: "running", contextSnapshot: { issueId } });
    await db.update(issues).set({ executionRunId: runId, executionPolicy: null, executionState: null,
      monitorNextCheckAt: null, monitorNotes: null, monitorScheduledBy: null }).where(eq(issues.id, issueId));
    const authority = new PaperclipRunnerToolAuthority(db, { companyId, issueId, agentId, runId });
    const monitor = { nextCheckAt: new Date(Date.now() + 10.8e6).toISOString(), notes: "Inspect pending CI." };
    const call = (arguments_: Record<string, unknown>) => authority.execute({
      tool: "set_task_monitor", callId: randomUUID(), arguments: arguments_,
    });
    try {
      await expect(call({ idempotencyKey: "check-ci", ...monitor })).rejects.toThrow();
      const [unchanged] = await db.select().from(issues).where(eq(issues.id, issueId));
      expect(unchanged.monitorNextCheckAt).toBeNull();
      expect(unchanged.executionPolicy).toBeNull();
      const [run] = await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, runId));
      expect(run.resultJson?.semanticToolReceipts).toBeUndefined();
      expect(await db.select().from(activityLog).where(eq(activityLog.entityId, issueId))).toHaveLength(0);
      expect(await db.select().from(agentWakeupRequests)).toHaveLength(0);

      const corrected = { idempotencyKey: "check-ci", monitor };
      await expect(call(corrected)).resolves.toMatchObject({ monitor: { ...monitor, status: "scheduled" }, replayed: false });
      await expect(call(corrected)).resolves.toMatchObject({ replayed: true });
      const [scheduled] = await db.select().from(issues).where(eq(issues.id, issueId));
      expect(scheduled.monitorNextCheckAt?.toISOString()).toBe(monitor.nextCheckAt);
      expect(scheduled.monitorScheduledBy).toBe("assignee");
      const activity = await db.select().from(activityLog).where(eq(activityLog.entityId, issueId));
      expect(activity.filter(row => row.action === "issue.monitor_scheduled")).toHaveLength(1);
    } finally {
      await db.update(heartbeatRuns).set({ status: "succeeded", finishedAt: new Date() }).where(eq(heartbeatRuns.id, runId));
      await db.update(issues).set({ executionRunId: null }).where(eq(issues.id, issueId));
    }

    const heartbeat = heartbeatService(db);
    const tickAt = new Date(Date.parse(monitor.nextCheckAt) + 1_000);
    expect((await heartbeat.tickTimers(tickAt)).enqueued).toBe(1);
    expect((await heartbeat.tickTimers(new Date(tickAt.getTime() + 1_000))).enqueued).toBe(0);
    const [triggered] = await db.select().from(issues).where(eq(issues.id, issueId));
    expect(triggered.monitorNextCheckAt).toBeNull();
    expect(triggered.monitorAttemptCount).toBe(1);
    const wakes = await db.select().from(agentWakeupRequests).where(eq(agentWakeupRequests.agentId, agentId));
    expect(wakes.filter(wake => wake.reason === "issue_monitor_due")).toHaveLength(1);
  });
});
