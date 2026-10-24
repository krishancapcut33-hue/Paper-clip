import { randomBytes, randomUUID } from "node:crypto";
import { agents, companies, createDb, environmentLeases, heartbeatRuns, issues, type Db } from "@paperclipai/db";
import { eq, type SQL } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "../__tests__/helpers/embedded-postgres.js";
import { getConversationOwnershipBlocker } from "./conversation-continuation.js";
import { isExternalChatPresentationContext } from "./heartbeat-run-summary.js";
import { repairCommittedNativeChatResponse } from "./native-runtime/native-run-finalizer.js";

const support = await getEmbeddedPostgresTestSupport();
describe.skipIf(!support.supported)("presentation and ownership PostgreSQL read projections", () => {
  let database: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    database = await startEmbeddedPostgresTestDatabase("presentation-ownership-read-");
    db = createDb(database.connectionString);
  }, 60_000);
  afterAll(async () => { await db?.$client.end(); await database?.cleanup(); });

  async function fixture(patch: Partial<typeof heartbeatRuns.$inferInsert> = {}) {
    const companyId = randomUUID(), agentId = randomUUID(), issueId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Read fixture", issuePrefix: companyId.slice(0, 8) });
    await db.insert(agents).values({ id: agentId, companyId, name: "Read agent", adapterType: "codex_local" });
    await db.insert(issues).values({ id: issueId, companyId, title: "Read task", status: "blocked", assigneeAgentId: agentId });
    const payload = randomBytes(128 * 1024).toString("base64");
    const [run] = await db.insert(heartbeatRuns).values({ companyId, agentId, nativeIssueId: issueId,
      status: "failed", runtimeMode: "legacy", finishedAt: new Date("2020-01-01T00:00:00Z"),
      contextSnapshot: { issueId, source: "chat:fixture", prompt: payload,
        paperclipWake: { externalInteractionContinuation: true, prompt: payload } },
      runnerProfileJson: { adapterDispatch: { adapterType: "codex_local", instructions: payload }, nativeExecutionInput: { prompt: payload } },
      resultJson: { unknownFutureRecoveryReceipt: { preserved: true } }, stdoutExcerpt: payload, stderrExcerpt: payload,
      ...patch,
    }).returning();
    return { companyId, agentId, issueId, run };
  }

  function captureReads(fullRows = false) {
    const rows: unknown[][] = [];
    function recordSelects<T extends Pick<Db, "select">>(executor: T): T {
      return new Proxy(executor, { get(target, key) {
        if (key !== "select") return Reflect.get(target, key);
        return (...fields: Parameters<Db["select"]>) => {
          const builder = target.select(...fields), from = builder.from.bind(builder);
          builder.from = ((...args: Parameters<typeof from>) => {
            const selection = fields[0];
            const nested = selection && "run" in selection && "activeLease" in selection;
            const query = fullRows && args[0] === heartbeatRuns
              ? (nested ? target.select({ run: heartbeatRuns, activeLease: selection.activeLease as SQL }) : target.select()).from(heartbeatRuns)
              : from(...args);
            if (args[0] === heartbeatRuns) {
              const execute = query.execute.bind(query);
              query.execute = async (...executeArgs: Parameters<typeof execute>) => {
                const result = await execute(...executeArgs); rows.push(result); return result;
              };
            }
            return query;
          }) as typeof builder.from;
          return builder;
        };
      }});
    }
    const root = recordSelects(db);
    const transaction: Db["transaction"] = (callback, config) => db.transaction(tx => callback(recordSelects(tx)), config);
    const recorded = new Proxy(root, { get(target, key) { return key === "transaction" ? transaction : Reflect.get(target, key); } });
    return { recorded, rows };
  }

  async function compareOwnership(f: Awaited<ReturnType<typeof fixture>>) {
    const baseline = captureReads(true), projected = captureReads();
    const expected = await getConversationOwnershipBlocker(baseline.recorded, f.companyId, f.issueId);
    const actual = await getConversationOwnershipBlocker(projected.recorded, f.companyId, f.issueId);
    expect(actual).toEqual(expected);
    expect(projected.rows.flat()).toHaveLength(1);
    expect(Buffer.byteLength(JSON.stringify(projected.rows))).toBeLessThan(4096);
    expect(Buffer.byteLength(JSON.stringify(baseline.rows))).toBeGreaterThan(128 * 1024);
    return actual;
  }

  it("keeps current process authority without reading execution payloads", async () => {
    const f = await fixture({ processPid: process.pid });
    expect(await compareOwnership(f)).toMatchObject({ runId: f.run.id, cause: "execution_owner_active" });
    expect((await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, f.run.id)))[0]).toEqual(f.run);
    expect(await getConversationOwnershipBlocker(db, randomUUID(), f.issueId)).toBeNull();
    await db.update(heartbeatRuns).set({ processPid: null }).where(eq(heartbeatRuns.id, f.run.id));
    expect(await getConversationOwnershipBlocker(db, f.companyId, f.issueId)).toBeNull();
  });

  it("retains an active lease until the current database row releases it", async () => {
    const f = await fixture();
    const [lease] = await db.insert(environmentLeases).values({ companyId: f.companyId, heartbeatRunId: f.run.id,
      issueId: f.issueId, provider: "daytona", providerLeaseId: "fixture-lease", status: "active" }).returning();
    expect(await compareOwnership(f)).toMatchObject({ runId: f.run.id, cause: "execution_owner_active" });
    expect((await db.select().from(environmentLeases).where(eq(environmentLeases.id, lease.id)))[0]).toEqual(lease);
    await db.update(environmentLeases).set({ status: "released", releasedAt: new Date("2020-01-01T00:00:00Z") }).where(eq(environmentLeases.id, lease.id));
    expect(await getConversationOwnershipBlocker(db, f.companyId, f.issueId)).toBeNull();
  });

  it("keeps unconfirmed remote cleanup and all recovery evidence", async () => {
    const f = await fixture();
    const [lease] = await db.insert(environmentLeases).values({ companyId: f.companyId, heartbeatRunId: f.run.id,
      issueId: f.issueId, provider: "daytona", providerLeaseId: "retained-fixture", status: "released",
      releasedAt: new Date("2020-01-01T00:00:00Z"), cleanupStatus: "success" }).returning();
    const result = { ...f.run.resultJson, workspaceRestoreFailure: "restore_unsafe_archive",
      workspaceRestoreRecovery: { schema: "paperclip.workspace-restore-recovery.v1", leaseIds: [lease.id] } };
    await db.update(heartbeatRuns).set({ resultJson: result }).where(eq(heartbeatRuns.id, f.run.id));
    expect(await compareOwnership(f)).toMatchObject({ runId: f.run.id, cause: "execution_owner_active" });
    expect((await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, f.run.id)))[0].resultJson).toEqual(result);
  });

  async function compareRepair(f: Awaited<ReturnType<typeof fixture>>) {
    const baseline = captureReads(true), projected = captureReads();
    const input = { companyId: f.companyId, issueId: f.issueId, runId: f.run.id };
    expect(await repairCommittedNativeChatResponse(projected.recorded, input))
      .toBe(await repairCommittedNativeChatResponse(baseline.recorded, input));
    expect(projected.rows.flat()).toHaveLength(1);
    expect(Buffer.byteLength(JSON.stringify(projected.rows))).toBeLessThan(4096);
    expect(Buffer.byteLength(JSON.stringify(baseline.rows))).toBeGreaterThan(128 * 1024);
    expect((await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, f.run.id)))[0]).toEqual(f.run);
    return projected.rows.flat()[0] as { contextSnapshot: Record<string, unknown> | null; resultJson: unknown };
  }

  it("preserves selected answers without downloading prompts, profiles, or excerpts", async () => {
    const f = await fixture({ runtimeMode: "native", status: "succeeded", resultJson: {
      presentationDecision: { commentId: randomUUID() }, unknownFutureReceipt: { preserved: true } } });
    const row = await compareRepair(f);
    expect(row.resultJson).toEqual(f.run.resultJson);
    expect(await repairCommittedNativeChatResponse(db, { companyId: randomUUID(), issueId: f.issueId, runId: f.run.id })).toBe(false);
    const [other] = await db.insert(issues).values({ companyId: f.companyId, title: "Other task" }).returning();
    expect(await repairCommittedNativeChatResponse(db, { companyId: f.companyId, issueId: other.id, runId: f.run.id })).toBe(false);
  });

  it.each([null, [], "scalar", 42, { source: 42, skipIssueComment: "true", paperclipWake: [] },
    { source: "issue.comment.created", externalChatContinuation: true },
    { source: "chat:fixture", skipIssueComment: true, paperclipWake: { externalInteractionContinuation: "true" } },
    { source: "internal", paperclipWake: { externalInteractionContinuation: true } },
  ].map(context => ({ context })))("preserves typed publication flags for $context", async ({ context }) => {
    const f = await fixture({ runtimeMode: "native", status: "succeeded", contextSnapshot: context as Record<string, unknown> | null });
    const row = await compareRepair(f);
    expect(isExternalChatPresentationContext(row.contextSnapshot)).toBe(isExternalChatPresentationContext(context));
    const original = context && typeof context === "object" && !Array.isArray(context) ? context : {};
    expect(row.contextSnapshot?.skipIssueComment === true).toBe((original as Record<string, unknown>).skipIssueComment === true);
  });

  it.each([null, ["stdout", { receipt: true }], "scalar", 42].map(result => ({ result })))("preserves non-object result evidence $result", async ({ result }) => {
    const f = await fixture({ runtimeMode: "native", status: "succeeded", resultJson: result as Record<string, unknown> | null });
    expect((await compareRepair(f)).resultJson).toEqual(result);
  });
});
