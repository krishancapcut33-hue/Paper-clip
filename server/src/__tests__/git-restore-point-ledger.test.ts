import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { agents, companies, createDb, executionWorkspaceRestorePoints, issues } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { gitRestorePointRetentionService } from "../services/git-restore-point-ledger.ts";
import type { StorageService } from "../storage/types.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres git restore point ledger tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

describeEmbeddedPostgres("git restore point retention", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const now = new Date();
  let deleted: string[];
  let failDeletes: boolean;
  const storage = {
    deleteObject: async (_companyId: string, objectKey: string) => {
      if (failDeletes) throw new Error("storage unavailable");
      deleted.push(objectKey);
    },
  } as unknown as StorageService;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-git-restore-point-ledger-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(executionWorkspaceRestorePoints);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seed(input: {
    status?: "pending" | "active" | "superseded" | "delete_requested";
    issueStatus?: string;
    closedDaysAgo?: number;
    openChild?: boolean;
    createdHoursAgo?: number;
    withoutIssue?: boolean;
  } = {}) {
    deleted = [];
    failDeletes = false;
    const companyId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Restore", issuePrefix: `R${companyId.slice(0, 6)}` });
    const issueStatus = input.issueStatus ?? "done";
    const closedAt = new Date(now.getTime() - (input.closedDaysAgo ?? 10) * DAY_MS);
    const [issue] = await db.insert(issues).values({
      companyId,
      title: "Work",
      status: issueStatus,
      completedAt: issueStatus === "done" ? closedAt : null,
      cancelledAt: issueStatus === "cancelled" ? closedAt : null,
    }).returning();
    if (input.openChild) {
      await db.insert(issues).values({ companyId, title: "Child", status: "blocked", parentId: issue!.id });
    }
    const workspaceId = randomUUID();
    const [row] = await db.insert(executionWorkspaceRestorePoints).values({
      companyId,
      executionWorkspaceId: workspaceId,
      sourceIssueId: input.withoutIssue ? randomUUID() : issue!.id,
      generation: 1,
      objectKey: `${companyId}/git-restore-points/${workspaceId}/1/${randomUUID()}.pcrp`,
      sha256: "a".repeat(64),
      byteSize: 1024,
      status: input.status ?? "active",
      createdAt: new Date(now.getTime() - (input.createdHoursAgo ?? 0) * 60 * 60 * 1000),
    }).returning();
    return row!;
  }

  function service(beforeExpire?: (row: typeof executionWorkspaceRestorePoints.$inferSelect) => Promise<void>) {
    return gitRestorePointRetentionService(db, { storage, now: () => now, beforeExpire });
  }

  async function reload(id: string) {
    const [row] = await db.select().from(executionWorkspaceRestorePoints).where(eq(executionWorkspaceRestorePoints.id, id));
    return row!;
  }

  it("keeps a restore point without a deadline while any issue in its tree is open", async () => {
    const row = await seed({ openChild: true });
    expect(await service().tick()).toMatchObject({ scheduled: 1, deleted: 0 });
    expect(await reload(row.id)).toMatchObject({ status: "active", deleteAfter: null, treeClosedAt: null });
    const open = await seed({ issueStatus: "in_progress" });
    await service().tick();
    expect(await reload(open.id)).toMatchObject({ status: "active", deleteAfter: null });
  });

  it("schedules deletion 90 days after the tree closes", async () => {
    const row = await seed({ closedDaysAgo: 10 });
    await service().tick();
    const reloaded = await reload(row.id);
    expect(reloaded.status).toBe("active");
    expect(reloaded.deleteAfter!.getTime() - reloaded.treeClosedAt!.getTime()).toBe(90 * DAY_MS);
    expect(deleted).toEqual([]);
  });

  it("expires and deletes a restore point once the retention window passes", async () => {
    const row = await seed({ closedDaysAgo: 91 });
    const beforeExpire = vi.fn(async () => {});
    expect(await service(beforeExpire).tick()).toMatchObject({ expired: 1, deleted: 1 });
    expect(beforeExpire).toHaveBeenCalledOnce();
    expect(deleted).toEqual([row.objectKey]);
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("does not delete when the expiry hook fails", async () => {
    const row = await seed({ closedDaysAgo: 91 });
    await expect(service(async () => { throw new Error("recipe busy"); }).tick()).rejects.toThrow("recipe busy");
    expect(await reload(row.id)).toMatchObject({ status: "active" });
    expect(deleted).toEqual([]);
  });

  it("deletes restore points whose source issue no longer exists", async () => {
    const row = await seed({ withoutIssue: true });
    expect(await service().tick()).toMatchObject({ orphaned: 1, deleted: 1 });
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("cleans up abandoned pending restore points but leaves recent ones", async () => {
    const stale = await seed({ status: "pending", createdHoursAgo: 2 });
    const recent = await seed({ status: "pending", createdHoursAgo: 0 });
    await service().tick();
    expect(await reload(stale.id)).toMatchObject({ status: "deleted" });
    expect(await reload(recent.id)).toMatchObject({ status: "pending" });
  });

  it("deletes superseded restore points", async () => {
    const row = await seed({ status: "superseded" });
    await service().tick();
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("records storage failures and retries on the next sweep", async () => {
    const row = await seed({ status: "delete_requested" });
    failDeletes = true;
    expect(await service().tick()).toMatchObject({ failed: 1, deleted: 0 });
    expect(await reload(row.id)).toMatchObject({ status: "delete_requested", lastError: "storage unavailable" });
    failDeletes = false;
    expect(await service().tick()).toMatchObject({ deleted: 1 });
    expect(await reload(row.id)).toMatchObject({ status: "deleted", lastError: null });
  });
});
