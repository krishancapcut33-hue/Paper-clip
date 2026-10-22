import { subscribeDatabaseWork } from "@paperclipai/db";
import { DELIVERY_QUEUES } from "../delivery-work-notifications.js";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { activityLog, agents, agentWakeupRequests, authUsers, companyMemberships, companies, completionContracts, createDb, heartbeatRuns, issues, nativeRunFinalizations, nativeRunResults, statusDecisions } from "@paperclipai/db";
import { PROVIDER_QUOTA_MONITOR_SERVICE_NAME } from "@paperclipai/shared";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "../../__tests__/helpers/embedded-postgres.js";
import { PaperclipRunnerToolAuthority } from "./paperclip-runner-tool-authority.js";
import { buildIssueMonitorTriggeredPatch, normalizeIssueExecutionPolicy } from "../issue-execution-policy.js";
import { nativeCompletionFeedback } from "./native-completion-feedback.js";
import { finalizeNativeRun } from "./native-run-finalizer.js";
import * as monitorDelivery from "./native-monitor-delivery.js";
import type { PrpStructuredRunResult } from "../../vendor/paperclip-runner/index.js";
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
if (!embeddedPostgresSupport.supported) {
  console.warn(`Skipping embedded Postgres native task monitor tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`);
}
describeEmbeddedPostgres("native task monitors", () => {
let temporary: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>>;
let db: ReturnType<typeof createDb>;
beforeAll(async () => {
    temporary = await startEmbeddedPostgresTestDatabase("native-task-monitor-");
    db = createDb(temporary.connectionString);
  });
afterAll(async () => { await temporary?.cleanup(); });
async function fixture() {
    const companyId = randomUUID(), agentId = randomUUID(), issueId = randomUUID(), runId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Monitors", issuePrefix: `M${companyId.slice(0, 7)}` });
    await db.insert(agents).values({ id: agentId, companyId, name: "Worker", adapterType: "paperclip_runner", status: "active" });
    await db.insert(issues).values({ id: issueId, companyId, title: "Deferred check", status: "in_progress", assigneeAgentId: agentId });
    await db.insert(heartbeatRuns).values({ id: runId, companyId, agentId, nativeIssueId: issueId, runtimeMode: "native", status: "running", contextSnapshot: { issueId } });
    await db.update(issues).set({ executionRunId: runId }).where(eq(issues.id, issueId));
    const binding = { companyId, agentId, issueId, runId };
    const authority = new PaperclipRunnerToolAuthority(db, binding);
    const monitor = { nextCheckAt: new Date(Date.now() + 10.8e6).toISOString(), notes: "Compare this task's run and session identities." };
    const call = (args: Record<string, unknown>) => authority.execute({ tool: "set_task_monitor", callId: randomUUID(), arguments: args });
    const read = async () => (await db.select().from(issues).where(eq(issues.id, issueId)))[0]!;
    return { ...binding, binding, authority, monitor, call, read };
  }
it("rejects the server-owned quota recovery name without promising a wake", async () => {
    const value = await fixture();
    await expect(value.call({ idempotencyKey: "quota", monitor: {
      ...value.monitor, serviceName: PROVIDER_QUOTA_MONITOR_SERVICE_NAME, externalRef: value.runId,
    } })).rejects.toThrow("reserved for server-owned quota recovery");
    expect((await value.read()).monitorNextCheckAt).toBeNull();
    const audits = await db.select().from(activityLog).where(eq(activityLog.entityId, value.issueId));
    expect(audits).toHaveLength(0);
    const [run] = await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, value.runId));
    expect(run.resultJson?.semanticToolReceipts).toBeUndefined();
    await expect(value.call({ idempotencyKey: "quota", monitor: {
      ...value.monitor, serviceName: "Provider usage dashboard",
    } })).resolves.toMatchObject({ monitor: { status: "scheduled" }, replayed: false });
  });
it.each(["failed_successor", "running_successor", "no_receipt", "other_task", "other_agent", "unadmitted", "still_owned", "ownership_race", "workspace_failed"] as const)(
    "settles a saved monitor result only with admitted delivery and settled ownership (%s)", async (state) => {
    const value = await fixture();
    await value.call({ idempotencyKey: "schedule", monitor: value.monitor });
    const contractId = randomUUID(), resultId = randomUUID(), successorId = randomUUID();
    await db.insert(completionContracts).values({
      id: contractId, companyId: value.companyId, issueId: value.issueId, revision: 1,
      schemaVersion: "paperclip.completion-contract.v1", policyVersion: "test",
      risk: "standard", completionAuthority: "server_arbiter", incompleteCriteriaPolicy: "preserve_non_terminal",
      contractJson: { revision: "test", criteria: [] }, canonicalSha256: randomUUID(),
      createdByActorType: "system", createdByActorId: "test",
    });
    const resultJson = {
      result: {
        schema: "paperclip.run_result.v1", reportedWorkDisposition: "yielded", summary: "Continue in the selected workspace.",
        completionClaim: { contractRevision: "test", objectiveSatisfied: false, criteria: [],
          remainingWork: [{ description: "Measure the archive", blocksCompletion: true }] },
        continuation: { kind: "monitor", summary: "Wait for the saved check", idempotencyKey: "provider-selected-key" },
        evidence: [], verification: [], attentionRequests: [], artifacts: [],
      },
      terminal: { schema: "paperclip.prp.terminal.v1", runTerminalState: "succeeded", turnTerminalState: "completed", reportedWorkDisposition: "yielded" },
    };
    await db.update(heartbeatRuns).set({ status: "succeeded", completionContractId: contractId })
      .where(eq(heartbeatRuns.id, value.runId));
    await db.insert(nativeRunResults).values({
      id: resultId, companyId: value.companyId, issueId: value.issueId, runId: value.runId,
      completionContractId: contractId, serverFingerprint: randomUUID(), canonicalSha256: randomUUID(),
      schemaStatus: "accepted", resultJson,
    });
    await db.insert(nativeRunFinalizations).values({
      companyId: value.companyId, issueId: value.issueId, runId: value.runId,
      phase: "retryable_failure", resultId, failureCode: "monitor_wait_authority_lost",
    });
    const successorAgentId = state === "other_agent" ? randomUUID() : value.agentId;
    if (state === "other_agent") await db.insert(agents).values({
      id: successorAgentId, companyId: value.companyId, name: "Another agent", adapterType: "paperclip_runner",
    });
    await db.insert(heartbeatRuns).values({
      id: successorId, companyId: value.companyId, agentId: successorAgentId,
      status: state === "running_successor" ? "running" : "failed",
      contextSnapshot: { issueId: state === "other_task" ? randomUUID() : value.issueId },
      error: "Previous task run still owns workspace recovery",
    });
    const scheduled = await value.read();
    let executionRunId = state === "still_owned" ? value.runId : state === "running_successor" ? successorId : null;
    await db.update(issues).set({
      ...buildIssueMonitorTriggeredPatch({ issue: scheduled, policy: normalizeIssueExecutionPolicy(scheduled.executionPolicy), triggeredAt: new Date() }),
      executionRunId, checkoutRunId: executionRunId,
    }).where(eq(issues.id, value.issueId));
                                                                                  
    await finalizeNativeRun({ db, runId: value.runId, workspaceFinalizeStatus: "succeeded" });
    expect((await db.select().from(nativeRunFinalizations).where(eq(nativeRunFinalizations.runId, value.runId)))[0])
      .toMatchObject({ phase: "retryable_failure", failureCode: "monitor_wait_authority_lost" });
    const [wake] = await db.insert(agentWakeupRequests).values({
      companyId: value.companyId, agentId: value.agentId, source: "automation", reason: "issue_monitor_due",
      status: state === "unadmitted" ? "queued" : state === "running_successor" ? "claimed" : "failed",
      runId: state === "unadmitted" ? null : successorId,
      idempotencyKey: `issue-monitor:${value.issueId}:${value.monitor.nextCheckAt}`,
      payload: { issueId: value.issueId, nextCheckAt: value.monitor.nextCheckAt },
    }).returning();
    if (state === "no_receipt") await db.update(heartbeatRuns).set({ resultJson: {} }).where(eq(heartbeatRuns.id, value.runId));

    const workspaceFinalizeStatus = state === "workspace_failed" ? "failed" : "succeeded";
    const settles = state === "failed_successor" || state === "running_successor";
    if (settles) expect(await monitorDelivery.readNativeMonitorDelivery(db, value.binding))
      .toEqual({ wakeId: wake!.id, successorRunId: successorId });
    const original = monitorDelivery.readNativeMonitorDelivery;
    const race = state === "ownership_race"
      ? vi.spyOn(monitorDelivery, "readNativeMonitorDelivery").mockImplementationOnce(async (...args) => {
          const delivery = await original(...args);
          expect(delivery).not.toBeNull();
          executionRunId = value.runId;
          await db.update(issues).set({ executionRunId, checkoutRunId: executionRunId }).where(eq(issues.id, value.issueId));
          return delivery;
        }) : null;
    try {
      await finalizeNativeRun({ db, runId: value.runId, workspaceFinalizeStatus });
    } finally {
      race?.mockRestore();
    }
    const [finalization] = await db.select({
      phase: nativeRunFinalizations.phase, code: nativeRunFinalizations.failureCode, detail: nativeRunFinalizations.failureDetail,
    }).from(nativeRunFinalizations).where(eq(nativeRunFinalizations.runId, value.runId));
    expect(finalization, JSON.stringify(finalization)).toMatchObject({ phase: settles ? "committed" : "retryable_failure" });
    expect(await value.read()).toMatchObject({ status: "in_progress", executionRunId, checkoutRunId: executionRunId, monitorNextCheckAt: null });
    expect((await db.select().from(nativeRunResults).where(eq(nativeRunResults.id, resultId)))[0].resultJson).toEqual(resultJson);
    const decisions = await db.select().from(statusDecisions).where(eq(statusDecisions.runId, value.runId));
    expect(decisions.some(decision => decision.reasonCode === "scheduled_monitor_dispatched")).toBe(settles);
    if (settles) {
      await finalizeNativeRun({ db, runId: value.runId, workspaceFinalizeStatus });
      expect(await db.select().from(statusDecisions).where(eq(statusDecisions.runId, value.runId))).toEqual(decisions);
    }
    expect(await db.select().from(agentWakeupRequests).where(eq(agentWakeupRequests.companyId, value.companyId))).toEqual([wake]);
  });
});
