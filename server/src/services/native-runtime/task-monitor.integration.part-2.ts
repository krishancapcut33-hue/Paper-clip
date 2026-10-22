import { subscribeDatabaseWork } from "@paperclipai/db";
import { DELIVERY_QUEUES } from "../delivery-work-notifications.js";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activityLog, agents, authUsers, companyMemberships, companies, createDb, heartbeatRuns, issues } from "@paperclipai/db";
import { PROVIDER_QUOTA_MONITOR_SERVICE_NAME } from "@paperclipai/shared";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "../../__tests__/helpers/embedded-postgres.js";
import { PaperclipRunnerToolAuthority } from "./paperclip-runner-tool-authority.js";
import { buildIssueMonitorTriggeredPatch, normalizeIssueExecutionPolicy } from "../issue-execution-policy.js";
import { nativeCompletionFeedback } from "./native-completion-feedback.js";
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
    const monitor = { nextCheckAt: new Date(Date.now() + 10_800_000).toISOString(), notes: "Compare this task's run and session identities." };
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
});
