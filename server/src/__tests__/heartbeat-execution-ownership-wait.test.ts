import { randomUUID } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentWakeupRequests, agents, companies, createDb, environmentLeases, heartbeatRuns, issues,
} from "@paperclipai/db";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";
import { getExecutionBlocker } from "../services/execution-blocker.js";
import { heartbeatService } from "../services/heartbeat.js";

const support = await getEmbeddedPostgresTestSupport();
(support.supported ? describe : describe.skip)("wakes parked behind an execution ownership hold", () => {
  let database: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    database = await startEmbeddedPostgresTestDatabase("execution-ownership-wait-");
    db = createDb(database.connectionString);
  }, 90_000);
  afterAll(async () => { await database?.cleanup(); });

  type Fixture = Awaited<ReturnType<typeof seed>>;

  /**
   * The production shape of a stage handoff: the outgoing run was cancelled
   * for the reassignment, its provider stop was acknowledged, and its
   * environment lease is still held while executor cleanup runs.
   */
  async function seed(input: { stage?: boolean } = {}) {
    const stage = input.stage ?? true;
    const companyId = randomUUID(), previousAgentId = randomUUID(), nextAgentId = randomUUID();
    const issueId = randomUUID(), runId = randomUUID(), stageId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Handoff", defaultResponsibleUserId: "board", issuePrefix: "H" + companyId.replaceAll("-", "") });
    await db.insert(agents).values([
      { id: previousAgentId, companyId, name: "Author", role: "engineer", adapterType: "opencode_local", status: "idle", runtimeConfig: { heartbeat: { maxConcurrentRuns: 1 } } },
      { id: nextAgentId, companyId, name: "Reviewer", role: "engineer", adapterType: "opencode_local", status: "idle", runtimeConfig: { heartbeat: { maxConcurrentRuns: 1 } } },
    ]);
    const participant = { type: "agent", agentId: nextAgentId, userId: null };
    const returnAssignee = { type: "agent", agentId: previousAgentId, userId: null };
    const executionState = {
      status: "pending", currentStageId: stageId, currentStageIndex: 0, currentStageType: "review",
      currentParticipant: participant, returnAssignee, reviewRequest: null, completedStageIds: [],
      lastDecisionId: null, lastDecisionOutcome: null, changesRequestedCount: 0,
    };
    await db.insert(issues).values({
      id: issueId, companyId, title: "Review the change", assigneeAgentId: nextAgentId,
      ...(stage ? { status: "in_review", executionState } : { status: "in_progress" }),
    });
    const finishedAt = new Date(Date.now() - 500);
    await db.insert(heartbeatRuns).values({
      id: runId, companyId, agentId: previousAgentId, runtimeMode: "legacy", status: "cancelled",
      errorCode: "issue_reassigned", error: "Cancelled before issue reassignment",
      createdAt: new Date(Date.now() - 60_000), startedAt: new Date(Date.now() - 59_000), finishedAt,
      contextSnapshot: { issueId, taskId: issueId, wakeReason: "issue_assigned" },
      resultJson: {
        conversationContinuation: "continue_conversation_v1", reassignmentStopConfirmed: true,
        executionCancellation: { state: "acknowledged", acknowledgedAt: finishedAt.toISOString() },
        cancellation: { reason: "Cancelled before issue reassignment", source: "control_plane", expected: true },
      },
    });
    const [lease] = await db.insert(environmentLeases).values({
      companyId, issueId, heartbeatRunId: runId, status: "active", provider: "local",
    }).returning();
    // Occupy the next agent so admission queues its run without launching a provider.
    const [busy] = await db.insert(heartbeatRuns).values({ companyId, agentId: nextAgentId, status: "running" }).returning();
    const executionStage = {
      stageId, wakeRole: "reviewer", stageType: "review", reviewRequest: null,
      allowedActions: ["approve", "request_changes"], returnAssignee, currentParticipant: participant, lastDecisionOutcome: null,
    };
    const wake = stage
      ? {
          source: "assignment" as const, triggerDetail: "system" as const, reason: "execution_review_requested",
          payload: { issueId, mutation: "update", executionStage, interruptedRunId: runId },
          requestedByActorType: "agent" as const, requestedByActorId: previousAgentId,
          contextSnapshot: { issueId, taskId: issueId, wakeReason: "execution_review_requested", source: "issue.execution_stage", executionStage, interruptedRunId: runId },
        }
      : {
          source: "assignment" as const, triggerDetail: "system" as const, reason: "issue_assigned",
          payload: { issueId, mutation: "update", interruptedRunId: runId },
          requestedByActorType: "user" as const, requestedByActorId: "board",
          contextSnapshot: { issueId, source: "issue.update", interruptedRunId: runId },
        };
    return { companyId, previousAgentId, nextAgentId, issueId, runId, stageId, lease: lease!, busy: busy!, wake };
  }

  const nextAgentWakes = (f: Fixture) => db.select().from(agentWakeupRequests).where(and(
    eq(agentWakeupRequests.companyId, f.companyId), eq(agentWakeupRequests.agentId, f.nextAgentId),
  )).orderBy(asc(agentWakeupRequests.requestedAt));
  const nextAgentIssueRuns = (f: Fixture) => db.select().from(heartbeatRuns).where(and(
    eq(heartbeatRuns.companyId, f.companyId), eq(heartbeatRuns.agentId, f.nextAgentId), ne(heartbeatRuns.id, f.busy.id),
  )).orderBy(asc(heartbeatRuns.createdAt));
  const releaseLease = (f: Fixture) => db.update(environmentLeases)
    .set({ status: "expired", releasedAt: new Date() }).where(eq(environmentLeases.id, f.lease.id));

  async function parkWake(f: Fixture) {
    const heartbeat = heartbeatService(db);
    expect(await getExecutionBlocker(db, f.companyId, f.issueId)).toMatchObject({ runId: f.runId, cause: "execution_owner_active", recoveryActionId: null });
    expect(await heartbeat.wakeup(f.nextAgentId, f.wake)).toBeNull();
    const [parked] = await nextAgentWakes(f);
    expect(parked).toMatchObject({
      status: "deferred_issue_execution", runId: null, finishedAt: null,
      payload: { issueId: f.issueId, executionWait: { cause: "execution_owner_active", runId: f.runId, recoveryActionId: null } },
    });
    expect(await nextAgentIssueRuns(f)).toHaveLength(0);
    return { heartbeat, parked: parked! };
  }

  it("parks a stage handoff wake behind the outgoing lease and admits it once after the release", async () => {
    const f = await seed();
    const { heartbeat, parked } = await parkWake(f);

    // Cleanup has not finished: nothing to admit yet.
    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    expect(await nextAgentIssueRuns(f)).toHaveLength(0);
    expect((await nextAgentWakes(f))[0]!.status).toBe("deferred_issue_execution");

    await releaseLease(f);
    expect(await getExecutionBlocker(db, f.companyId, f.issueId)).toBeNull();
    await Promise.all([
      heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId }),
      heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId }),
    ]);
    const runs = await nextAgentIssueRuns(f);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "queued", invocationSource: "assignment", triggerDetail: "system" });
    expect(runs[0]!.contextSnapshot).toMatchObject({
      issueId: f.issueId, wakeReason: "execution_review_requested", interruptedRunId: f.runId,
      executionStage: { stageId: f.stageId, wakeRole: "reviewer", currentParticipant: { agentId: f.nextAgentId } },
    });
    const wakes = await nextAgentWakes(f);
    expect(wakes.find(wake => wake.id === parked.id)).toMatchObject({ status: "coalesced", runId: runs[0]!.id });
    expect(wakes.find(wake => wake.runId === runs[0]!.id && wake.status === "queued")).toMatchObject({
      reason: "execution_review_requested", requestedByActorType: "agent", requestedByActorId: f.previousAgentId,
      idempotencyKey: `execution-wait-resume:${parked.id}`,
    });
    expect(wakes.filter(wake => wake.status === "skipped")).toHaveLength(0);

    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    await heartbeat.resumeQueuedRuns();
    expect(await nextAgentIssueRuns(f)).toHaveLength(1);
  });

  it("parks a plain assignment handoff the same way", async () => {
    const f = await seed({ stage: false });
    const { heartbeat, parked } = await parkWake(f);
    await releaseLease(f);
    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    const runs = await nextAgentIssueRuns(f);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.contextSnapshot).toMatchObject({ issueId: f.issueId, wakeReason: "issue_assigned", interruptedRunId: f.runId });
    expect((await nextAgentWakes(f)).find(wake => wake.id === parked.id)).toMatchObject({ status: "coalesced", runId: runs[0]!.id });
  });

  it("is picked up by the periodic sweep when the lease is released elsewhere", async () => {
    const f = await seed();
    const { heartbeat, parked } = await parkWake(f);
    await releaseLease(f);
    // The sweep rotates receipts on a cadence; age this one past it.
    await db.update(agentWakeupRequests).set({ updatedAt: new Date(Date.now() - 60_000) }).where(eq(agentWakeupRequests.id, parked.id));
    await Promise.all([heartbeat.resumeQueuedRuns(), heartbeat.resumeQueuedRuns()]);
    const runs = await nextAgentIssueRuns(f);
    expect(runs).toHaveLength(1);
    expect((await nextAgentWakes(f)).find(wake => wake.id === parked.id)).toMatchObject({ status: "coalesced", runId: runs[0]!.id });
  });

  it("merges a repeated signal into the parked receipt", async () => {
    const f = await seed();
    const { heartbeat, parked } = await parkWake(f);
    expect(await heartbeat.wakeup(f.nextAgentId, f.wake)).toBeNull();
    const wakes = await nextAgentWakes(f);
    expect(wakes).toHaveLength(1);
    expect(wakes[0]).toMatchObject({ id: parked.id, status: "deferred_issue_execution", coalescedCount: 1 });
    await releaseLease(f);
    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    expect(await nextAgentIssueRuns(f)).toHaveLength(1);
  });

  it("is consumed by a later wake of the same agent instead of resuming as a second run", async () => {
    const f = await seed();
    const { heartbeat, parked } = await parkWake(f);
    await releaseLease(f);
    const later = await heartbeat.wakeup(f.nextAgentId, {
      source: "on_demand", triggerDetail: "manual", reason: "issue_commented",
      payload: { issueId: f.issueId }, contextSnapshot: { issueId: f.issueId },
      requestedByActorType: "user", requestedByActorId: "board",
    });
    expect(later).toMatchObject({ status: "queued" });
    expect((await nextAgentWakes(f)).find(wake => wake.id === parked.id)).toMatchObject({ status: "coalesced", runId: later!.id });
    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    await heartbeat.resumeQueuedRuns();
    expect(await nextAgentIssueRuns(f)).toEqual([expect.objectContaining({ id: later!.id })]);
  });

  it("retires the receipt when a later run of the agent already started on the task", async () => {
    const f = await seed();
    const { heartbeat, parked } = await parkWake(f);
    const [started] = await db.insert(heartbeatRuns).values({
      companyId: f.companyId, agentId: f.nextAgentId, runtimeMode: "legacy", status: "succeeded",
      startedAt: new Date(), finishedAt: new Date(), contextSnapshot: { issueId: f.issueId, wakeReason: "issue_commented" },
    }).returning();
    await releaseLease(f);
    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    expect((await nextAgentWakes(f)).find(wake => wake.id === parked.id)).toMatchObject({ status: "cancelled", runId: null });
    expect(await nextAgentIssueRuns(f)).toEqual([expect.objectContaining({ id: started!.id })]);
  });

  it("waits behind a queued run of the agent that has not started yet", async () => {
    const f = await seed();
    const { heartbeat, parked } = await parkWake(f);
    const [queued] = await db.insert(heartbeatRuns).values({
      companyId: f.companyId, agentId: f.nextAgentId, runtimeMode: "legacy", status: "queued",
      contextSnapshot: { issueId: f.issueId, wakeReason: "issue_commented" },
    }).returning();
    await releaseLease(f);
    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    expect((await nextAgentWakes(f)).find(wake => wake.id === parked.id)).toMatchObject({ status: "deferred_issue_execution" });
    expect(await nextAgentIssueRuns(f)).toEqual([expect.objectContaining({ id: queued!.id })]);
  });

  it.each(["participant", "stage", "closed"])("retires a stage receipt the task moved past (%s)", async change => {
    const f = await seed();
    const { heartbeat, parked } = await parkWake(f);
    const [issue] = await db.select().from(issues).where(eq(issues.id, f.issueId));
    const state = issue!.executionState as Record<string, unknown>;
    await db.update(issues).set(
      change === "closed" ? { status: "done" }
        : change === "stage" ? { executionState: { ...state, currentStageId: randomUUID() } }
          : { executionState: { ...state, currentParticipant: { type: "agent", agentId: f.previousAgentId, userId: null } } },
    ).where(eq(issues.id, f.issueId));
    await releaseLease(f);
    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    expect((await nextAgentWakes(f)).find(wake => wake.id === parked.id)).toMatchObject({ status: "cancelled" });
    expect(await nextAgentIssueRuns(f)).toHaveLength(0);
  });

  it("retires an assignment receipt once the task belongs to someone else", async () => {
    const f = await seed({ stage: false });
    const { heartbeat, parked } = await parkWake(f);
    await db.update(issues).set({ assigneeAgentId: f.previousAgentId }).where(eq(issues.id, f.issueId));
    await releaseLease(f);
    await heartbeat.resumeExecutionOwnershipWaits({ companyId: f.companyId, issueId: f.issueId });
    expect((await nextAgentWakes(f)).find(wake => wake.id === parked.id)).toMatchObject({ status: "cancelled" });
    expect(await nextAgentIssueRuns(f)).toHaveLength(0);
  });
});
