import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { agents, companies, createDb, executionWorkspaceRestorePoints, issues } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import {
  GIT_RESTORE_POINT_RETRY_MS,
  gitRestorePointRetentionService,
  registerGitRestorePointWork,
  requestRestorePointDeletion,
} from "../services/git-restore-point-ledger.ts";
import { issueService } from "../services/issues.ts";
import { deleteCompany } from "../services/company-deletion.ts";
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
  let deleted: string[] = [];
  let failDeletes = false;
  let silentlyKeep = false;
  const storage = {
    deleteObject: async (_companyId: string, objectKey: string) => {
      if (failDeletes) throw new Error("storage unavailable");
      if (!silentlyKeep) deleted.push(objectKey);
    },
    headObject: async (_companyId: string, objectKey: string) => ({ exists: silentlyKeep && !deleted.includes(objectKey) }),
  } as unknown as StorageService;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-git-restore-point-ledger-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    deleted = [];
    failDeletes = false;
    silentlyKeep = false;
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
    deleteAfter?: Date | null;
    companyId?: string;
  } = {}) {
    const companyId = input.companyId ?? randomUUID();
    if (!input.companyId) {
      await db.insert(companies).values({ id: companyId, name: "Restore", issuePrefix: `R${companyId.slice(0, 6)}` });
    }
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
      deleteAfter: input.deleteAfter ?? null,
      createdAt: new Date(now.getTime() - (input.createdHoursAgo ?? 0) * 60 * 60 * 1000),
    }).returning();
    return row!;
  }

  function service(options: { at?: Date; beforeExpire?: (row: typeof executionWorkspaceRestorePoints.$inferSelect) => Promise<void> } = {}) {
    return gitRestorePointRetentionService(db, { storage, now: () => options.at ?? now, beforeExpire: options.beforeExpire });
  }

  async function reload(id: string) {
    const [row] = await db.select().from(executionWorkspaceRestorePoints).where(eq(executionWorkspaceRestorePoints.id, id));
    return row!;
  }

  it("rechecks a restore point in 30 days while its tree is open", async () => {
    const row = await seed({ openChild: true });
    expect(await service().tick()).toMatchObject({ scheduled: 1, deleted: 0 });
    const reloaded = await reload(row.id);
    expect(reloaded).toMatchObject({ status: "active", treeClosedAt: null });
    expect(reloaded.deleteAfter!.getTime()).toBe(now.getTime() + 30 * DAY_MS);
  });

  it("schedules deletion 90 days after the tree closes", async () => {
    const row = await seed({ closedDaysAgo: 10 });
    await service().tick();
    const reloaded = await reload(row.id);
    expect(reloaded.status).toBe("active");
    expect(reloaded.deleteAfter!.getTime() - reloaded.treeClosedAt!.getTime()).toBe(90 * DAY_MS);
    expect(deleted).toEqual([]);
  });

  it("expires and deletes a restore point at its deadline once the tree has been closed long enough", async () => {
    const row = await seed({ closedDaysAgo: 91, deleteAfter: new Date(now.getTime() - 1000) });
    const beforeExpire = vi.fn(async () => {});
    expect(await service({ beforeExpire }).tick()).toMatchObject({ expired: 1, deleted: 1 });
    expect(beforeExpire).toHaveBeenCalledOnce();
    expect(deleted).toEqual([row.objectKey]);
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("does not delete when the expiry hook fails", async () => {
    const row = await seed({ closedDaysAgo: 91 });
    await expect(service({ beforeExpire: async () => { throw new Error("recipe busy"); } }).tick()).rejects.toThrow("recipe busy");
    expect(await reload(row.id)).toMatchObject({ status: "active" });
    expect(deleted).toEqual([]);
  });

  it("deletes restore points whose source issue no longer exists at review", async () => {
    const row = await seed({ withoutIssue: true });
    expect(await service().tick()).toMatchObject({ orphaned: 1, deleted: 1 });
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("evaluates only restore points that are due, so retained ones cause no rescans", async () => {
    for (let index = 0; index < 60; index += 1) await seed({ closedDaysAgo: 10, deleteAfter: new Date(now.getTime() + DAY_MS) });
    expect(await service().tick()).toMatchObject({ scheduled: 0, expired: 0, truncated: false });
    expect(await service().nextDeadlineAt()).toBe(now.getTime() + DAY_MS);
  });

  it("works through a backlog of due restore points in bounded batches", async () => {
    for (let index = 0; index < 60; index += 1) await seed({ closedDaysAgo: 10 });
    expect(await service().tick()).toMatchObject({ scheduled: 50, truncated: true });
    expect(await service().tick()).toMatchObject({ scheduled: 10, truncated: false });
    expect(await service().tick()).toMatchObject({ scheduled: 0, truncated: false });
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

  it("does not mark an object deleted when it is still present after deletion", async () => {
    const row = await seed({ status: "delete_requested" });
    silentlyKeep = true;
    expect(await service().tick()).toMatchObject({ failed: 1, deleted: 0 });
    expect(await reload(row.id)).toMatchObject({ status: "delete_requested", lastError: "restore_point_object_still_present" });
  });

  it("retries a failed deletion only after its retry deadline", async () => {
    const row = await seed({ status: "delete_requested" });
    failDeletes = true;
    expect(await service().tick()).toMatchObject({ failed: 1 });
    failDeletes = false;
    expect(await service().tick()).toMatchObject({ failed: 0, deleted: 0 });
    expect(await service().nextDeadlineAt()).toBe((await reload(row.id)).updatedAt.getTime() + GIT_RESTORE_POINT_RETRY_MS);
    expect(await service({ at: new Date(now.getTime() + GIT_RESTORE_POINT_RETRY_MS + 1000) }).tick()).toMatchObject({ deleted: 1 });
    expect(await reload(row.id)).toMatchObject({ status: "deleted", lastError: null });
  });

  it("reports the real next deadline, and none when idle", async () => {
    expect(await service().nextDeadlineAt()).toBeNull();
    const unscheduled = await seed({ closedDaysAgo: 10 });
    expect(await service().nextDeadlineAt()).toBe(now.getTime());
    await service().tick();
    expect(await service().nextDeadlineAt()).toBe((await reload(unscheduled.id)).deleteAfter!.getTime());
    const pending = await seed({ status: "pending", createdHoursAgo: 0 });
    expect(await service().nextDeadlineAt()).toBe((await reload(pending.id)).createdAt.getTime() + 60 * 60 * 1000);
    await seed({ status: "delete_requested" });
    expect(await service().nextDeadlineAt()).toBe(now.getTime());
  });

  it("marks only the deleted issue's restore points when an issue is removed", async () => {
    const removed = await seed({ deleteAfter: new Date(now.getTime() + 80 * DAY_MS) });
    const kept = await seed({ deleteAfter: new Date(now.getTime() + 80 * DAY_MS) });
    await issueService(db).remove(removed.sourceIssueId!);
    expect(await reload(removed.id)).toMatchObject({ status: "delete_requested" });
    expect(await reload(kept.id)).toMatchObject({ status: "active" });
    await service().tick();
    expect(deleted).toEqual([removed.objectKey]);
  });

  it("marks every restore point of a deleted company", async () => {
    const first = await seed({ deleteAfter: new Date(now.getTime() + 80 * DAY_MS) });
    const second = await seed({ companyId: first.companyId, status: "pending" });
    const other = await seed({ deleteAfter: new Date(now.getTime() + 80 * DAY_MS) });
    await deleteCompany(db, first.companyId);
    expect(await reload(first.id)).toMatchObject({ status: "delete_requested" });
    expect(await reload(second.id)).toMatchObject({ status: "delete_requested" });
    expect(await reload(other.id)).toMatchObject({ status: "active" });
    await service().tick();
    expect(deleted.sort()).toEqual([first.objectKey, second.objectKey].sort());
  });

  it("requests deletion by issue without touching superseded rows", async () => {
    const row = await seed({ status: "superseded" });
    await db.transaction(async (tx) => requestRestorePointDeletion(tx, { sourceIssueId: row.sourceIssueId! }));
    expect(await reload(row.id)).toMatchObject({ status: "superseded" });
  });

  it("schedules nothing when idle, and only the next deadline when restore points exist", async () => {
    let task!: { run: (signal: AbortSignal) => Promise<unknown>; nextRunAt?: () => number | null };
    const coordinator = { register: (_queue: string, registered: typeof task) => { task = registered; return { ready: Promise.resolve(), wake: vi.fn() }; } };
    registerGitRestorePointWork(coordinator as never, service(), () => {});
    await task.run(new AbortController().signal);
    expect(task.nextRunAt?.()).toBeNull();
    const row = await seed({ closedDaysAgo: 10 });
    await task.run(new AbortController().signal);
    expect(task.nextRunAt?.()).toBe((await reload(row.id)).deleteAfter!.getTime());
  });
});
