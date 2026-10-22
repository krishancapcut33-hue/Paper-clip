import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { agents, companies, createDb, executionWorkspaceRestorePoints, issues } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { GIT_RESTORE_POINT_RETRY_MS, gitRestorePointRetentionService, registerGitRestorePointWork } from "../services/git-restore-point-ledger.ts";
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
  let silentlyKeep: boolean;
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
    silentlyKeep = false;
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

  async function fullPass(beforeExpire?: (row: typeof executionWorkspaceRestorePoints.$inferSelect) => Promise<void>) {
    return (await service(beforeExpire).tick({ reevaluateAll: true })).result;
  }

  async function reload(id: string) {
    const [row] = await db.select().from(executionWorkspaceRestorePoints).where(eq(executionWorkspaceRestorePoints.id, id));
    return row!;
  }

  it("keeps a restore point without a deadline while any issue in its tree is open", async () => {
    const row = await seed({ openChild: true });
    expect(await fullPass()).toMatchObject({ scheduled: 1, deleted: 0 });
    expect(await reload(row.id)).toMatchObject({ status: "active", deleteAfter: null, treeClosedAt: null });
    const open = await seed({ issueStatus: "in_progress" });
    await fullPass();
    expect(await reload(open.id)).toMatchObject({ status: "active", deleteAfter: null });
  });

  it("schedules deletion 90 days after the tree closes", async () => {
    const row = await seed({ closedDaysAgo: 10 });
    await fullPass();
    const reloaded = await reload(row.id);
    expect(reloaded.status).toBe("active");
    expect(reloaded.deleteAfter!.getTime() - reloaded.treeClosedAt!.getTime()).toBe(90 * DAY_MS);
    expect(deleted).toEqual([]);
  });

  it("expires and deletes a restore point once the retention window passes", async () => {
    const row = await seed({ closedDaysAgo: 91 });
    const beforeExpire = vi.fn(async () => {});
    expect(await fullPass(beforeExpire)).toMatchObject({ expired: 1, deleted: 1 });
    expect(beforeExpire).toHaveBeenCalledOnce();
    expect(deleted).toEqual([row.objectKey]);
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("does not delete when the expiry hook fails", async () => {
    const row = await seed({ closedDaysAgo: 91 });
    await expect(fullPass(async () => { throw new Error("recipe busy"); })).rejects.toThrow("recipe busy");
    expect(await reload(row.id)).toMatchObject({ status: "active" });
    expect(deleted).toEqual([]);
  });

  it("deletes restore points whose source issue no longer exists", async () => {
    const row = await seed({ withoutIssue: true });
    expect(await fullPass()).toMatchObject({ orphaned: 1, deleted: 1 });
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("cleans up abandoned pending restore points but leaves recent ones", async () => {
    const stale = await seed({ status: "pending", createdHoursAgo: 2 });
    const recent = await seed({ status: "pending", createdHoursAgo: 0 });
    await fullPass();
    expect(await reload(stale.id)).toMatchObject({ status: "deleted" });
    expect(await reload(recent.id)).toMatchObject({ status: "pending" });
  });

  it("deletes superseded restore points", async () => {
    const row = await seed({ status: "superseded" });
    await fullPass();
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("does not mark an object deleted when it is still present after deletion", async () => {
    const row = await seed({ status: "delete_requested" });
    silentlyKeep = true;
    expect(await fullPass()).toMatchObject({ failed: 1, deleted: 0 });
    expect(await reload(row.id)).toMatchObject({ status: "delete_requested", lastError: "restore_point_object_still_present" });
  });

  it("reports no deadline when nothing is due", async () => {
    expect(await service().nextDeadlineAt()).toBeNull();
    await seed({ openChild: true });
    await fullPass();
    expect(await service().nextDeadlineAt()).toBeNull();
    expect(await service().hasActive()).toBe(true);
  });

  it("reports the real next deadline for each obligation", async () => {
    const closed = await seed({ closedDaysAgo: 10 });
    await fullPass();
    expect(await service().nextDeadlineAt()).toBe((await reload(closed.id)).deleteAfter!.getTime());
    const pending = await seed({ status: "pending", createdHoursAgo: 0 });
    expect(await service().nextDeadlineAt()).toBe((await reload(pending.id)).createdAt.getTime() + 60 * 60 * 1000);
    await seed({ status: "delete_requested" });
    expect(await service().nextDeadlineAt()).toBe(now.getTime());
  });

  it("schedules a failed deletion's retry instead of an immediate rescan", async () => {
    const row = await seed({ status: "delete_requested" });
    failDeletes = true;
    await fullPass();
    expect(await service().nextDeadlineAt()).toBe((await reload(row.id)).updatedAt.getTime() + GIT_RESTORE_POINT_RETRY_MS);
  });

  it("finishes a bounded pass over many retained restore points, then stops scanning", async () => {
    for (let index = 0; index < 60; index += 1) await seed({ closedDaysAgo: 10 });
    const retention = service();
    const first = await retention.tick({ reevaluateAll: true });
    expect(first.result.scheduled).toBe(50);
    expect(first.cursor).not.toBeNull();
    const second = await retention.tick({ reevaluateAll: true, cursor: first.cursor });
    expect(second.result.scheduled).toBe(10);
    expect(second.cursor).toBeNull();
    const idle = await retention.tick();
    expect(idle.result).toMatchObject({ scheduled: 0, truncated: false });
    expect(idle.cursor).toBeNull();
  });

  it("deletes a restore point when its source issue is deleted, even with a future expiry", async () => {
    const row = await seed({ closedDaysAgo: 10 });
    await fullPass();
    expect((await reload(row.id)).deleteAfter).not.toBeNull();
    await db.delete(issues).where(eq(issues.id, row.sourceIssueId!));
    expect((await service().tick({ changedIssueIds: [row.sourceIssueId!] })).result).toMatchObject({ orphaned: 1, deleted: 1 });
    expect(await reload(row.id)).toMatchObject({ status: "deleted" });
  });

  it("re-evaluates a source issue tree when a child changes", async () => {
    const row = await seed({ openChild: true });
    await fullPass();
    expect((await reload(row.id)).deleteAfter).toBeNull();
    const [child] = await db.select().from(issues).where(eq(issues.parentId, row.sourceIssueId!));
    await db.update(issues).set({ status: "done", completedAt: new Date(now.getTime() - DAY_MS) }).where(eq(issues.id, child!.id));
    await service().tick({ changedIssueIds: [child!.id] });
    expect((await reload(row.id)).deleteAfter).not.toBeNull();
  });

  it("does not retry a failed deletion before its retry deadline", async () => {
    await seed({ status: "delete_requested" });
    failDeletes = true;
    expect(await fullPass()).toMatchObject({ failed: 1 });
    failDeletes = false;
    expect(await fullPass()).toMatchObject({ failed: 0, deleted: 0 });
  });

  it("leaves no work scheduled when idle and wakes on issue changes only while restore points exist", async () => {
    let task!: { run: (signal: AbortSignal) => Promise<unknown>; nextRunAt?: () => number | null };
    const wake = vi.fn();
    const coordinator = { register: (_queue: string, registered: typeof task) => { task = registered; return { ready: Promise.resolve(), wake }; } };
    const worker = registerGitRestorePointWork(coordinator as never, service(), () => {});
    await task.run(new AbortController().signal);
    expect(task.nextRunAt?.()).toBeNull();
    worker.issueTreeChanged(new Set([`issue:${randomUUID()}`]));
    expect(wake).not.toHaveBeenCalled();
    await seed({ openChild: true });
    await task.run(new AbortController().signal);
    expect(task.nextRunAt?.()).toBeNull();
    worker.issueTreeChanged(new Set(["workspace:unrelated"]));
    expect(wake).not.toHaveBeenCalled();
    worker.issueTreeChanged(new Set([`issue:${randomUUID()}`]));
    expect(wake).toHaveBeenCalledOnce();
    worker.issueTreeChanged(undefined);
    expect(wake).toHaveBeenCalledTimes(2);
  });

  it("wakes on issue changes when every restore point already has a future expiry", async () => {
    let task!: { run: (signal: AbortSignal) => Promise<unknown>; nextRunAt?: () => number | null };
    const wake = vi.fn();
    const coordinator = { register: (_queue: string, registered: typeof task) => { task = registered; return { ready: Promise.resolve(), wake }; } };
    const row = await seed({ closedDaysAgo: 10 });
    const worker = registerGitRestorePointWork(coordinator as never, service(), () => {});
    await task.run(new AbortController().signal);
    expect(task.nextRunAt?.()).toBe((await reload(row.id)).deleteAfter!.getTime());
    worker.issueTreeChanged(new Set([`issue:${row.sourceIssueId}`]));
    expect(wake).toHaveBeenCalledOnce();
  });

  it("records storage failures and retries on the next sweep", async () => {
    const row = await seed({ status: "delete_requested" });
    failDeletes = true;
    expect(await fullPass()).toMatchObject({ failed: 1, deleted: 0 });
    expect(await reload(row.id)).toMatchObject({ status: "delete_requested", lastError: "storage unavailable" });
    failDeletes = false;
    const later = gitRestorePointRetentionService(db, { storage, now: () => new Date(now.getTime() + GIT_RESTORE_POINT_RETRY_MS + 1000) });
    expect((await later.tick()).result).toMatchObject({ deleted: 1 });
    expect(await reload(row.id)).toMatchObject({ status: "deleted", lastError: null });
  });
});
