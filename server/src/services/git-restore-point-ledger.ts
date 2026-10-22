import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { executionWorkspaceRestorePoints, type Db } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import type { createDeliveryWorkCoordinator } from "./delivery-work-coordinator.js";
import { DELIVERY_QUEUES, notifyDeliveryWork } from "./delivery-work-notifications.js";

export const GIT_RESTORE_POINT_RETRY_MS = 15 * 60 * 1000;
export const GIT_RESTORE_POINT_DEFAULT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PENDING_GRACE_MS = 60 * 60 * 1000;
const DEFAULT_BATCH = 50;
const OPEN_TREE_RECHECK_MS = 30 * DAY_MS;

type RestorePoint = typeof executionWorkspaceRestorePoints.$inferSelect;

export type GitRestorePointRetentionResult = {
  abandoned: number;
  scheduled: number;
  expired: number;
  orphaned: number;
  deleted: number;
  failed: number;
  truncated: boolean;
};

export type GitRestorePointRetentionOptions = {
  storage: StorageService;
  retentionDays?: number;
  pendingGraceMs?: number;
  batchSize?: number;
  now?: () => Date;
  beforeExpire?: (restorePoint: RestorePoint) => Promise<void>;
};

type TreeState = { exists: boolean; open: boolean; closedAt: Date | null };

export function gitRestorePointRetentionService(db: Db, options: GitRestorePointRetentionOptions) {
  const retentionMs = Math.max(1, options.retentionDays ?? GIT_RESTORE_POINT_DEFAULT_RETENTION_DAYS) * DAY_MS;
  const pendingGraceMs = options.pendingGraceMs ?? DEFAULT_PENDING_GRACE_MS;
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const now = options.now ?? (() => new Date());

  async function issueTreeState(row: RestorePoint): Promise<TreeState> {
    if (!row.sourceIssueId) return { exists: false, open: false, closedAt: null };
    const result = await db.execute<{ total: number; open: number; closed_at: string | null }>(sql`
      WITH RECURSIVE tree AS (
        SELECT id, status, completed_at, cancelled_at, updated_at FROM issues
        WHERE company_id = ${row.companyId} AND id = ${row.sourceIssueId}
        UNION
        SELECT c.id, c.status, c.completed_at, c.cancelled_at, c.updated_at FROM issues c
        JOIN tree p ON c.parent_id = p.id WHERE c.company_id = ${row.companyId}
      )
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status NOT IN ('done', 'cancelled'))::int AS open,
        max(CASE WHEN status = 'done' THEN coalesce(completed_at, updated_at)
          WHEN status = 'cancelled' THEN coalesce(cancelled_at, updated_at) END) AS closed_at
      FROM tree`);
    const state = result[0];
    if (!state || state.total === 0) return { exists: false, open: false, closedAt: null };
    return { exists: true, open: state.open > 0, closedAt: state.closed_at ? new Date(state.closed_at) : null };
  }

  async function requestDeletion(ids: string[], at: Date) {
    if (ids.length === 0) return;
    await db.update(executionWorkspaceRestorePoints)
      .set({ status: "delete_requested", updatedAt: at })
      .where(and(inArray(executionWorkspaceRestorePoints.id, ids),
        inArray(executionWorkspaceRestorePoints.status, ["pending", "active"])));
  }

  async function evaluateActive(row: RestorePoint, at: Date, result: GitRestorePointRetentionResult) {
    const tree = await issueTreeState(row);
    if (!tree.exists) {
      await requestDeletion([row.id], at);
      result.orphaned += 1;
      return;
    }
    const deleteAfter = tree.open || !tree.closedAt
      ? new Date(at.getTime() + Math.min(retentionMs, OPEN_TREE_RECHECK_MS))
      : new Date(tree.closedAt.getTime() + retentionMs);
    if (!tree.open && deleteAfter.getTime() <= at.getTime()) {
      await options.beforeExpire?.(row);
      await requestDeletion([row.id], at);
      result.expired += 1;
      return;
    }
    await db.update(executionWorkspaceRestorePoints)
      .set({ treeClosedAt: tree.open ? null : tree.closedAt, deleteAfter, updatedAt: at })
      .where(and(eq(executionWorkspaceRestorePoints.id, row.id), eq(executionWorkspaceRestorePoints.status, "active")));
    result.scheduled += 1;
  }

  async function tick() {
    const at = now();
    const result: GitRestorePointRetentionResult = { abandoned: 0, scheduled: 0, expired: 0, orphaned: 0, deleted: 0, failed: 0, truncated: false };

    const abandoned = await db.select({ id: executionWorkspaceRestorePoints.id }).from(executionWorkspaceRestorePoints)
      .where(and(eq(executionWorkspaceRestorePoints.status, "pending"),
        lt(executionWorkspaceRestorePoints.createdAt, new Date(at.getTime() - pendingGraceMs))))
      .orderBy(asc(executionWorkspaceRestorePoints.createdAt)).limit(batchSize);
    await requestDeletion(abandoned.map((row) => row.id), at);
    result.abandoned = abandoned.length;

    const due = await db.select().from(executionWorkspaceRestorePoints)
      .where(and(eq(executionWorkspaceRestorePoints.status, "active"),
        or(isNull(executionWorkspaceRestorePoints.deleteAfter), lte(executionWorkspaceRestorePoints.deleteAfter, at))))
      .orderBy(asc(executionWorkspaceRestorePoints.deleteAfter), asc(executionWorkspaceRestorePoints.id)).limit(batchSize);
    for (const row of due) await evaluateActive(row, at, result);

    const doomed = await db.select().from(executionWorkspaceRestorePoints)
      .where(and(inArray(executionWorkspaceRestorePoints.status, ["superseded", "delete_requested"]),
        or(isNull(executionWorkspaceRestorePoints.lastError),
          lte(executionWorkspaceRestorePoints.updatedAt, new Date(at.getTime() - GIT_RESTORE_POINT_RETRY_MS)))))
      .orderBy(asc(executionWorkspaceRestorePoints.updatedAt), asc(executionWorkspaceRestorePoints.id)).limit(batchSize);
    for (const row of doomed) {
      try {
        await options.storage.deleteObject(row.companyId, row.objectKey);
        if ((await options.storage.headObject(row.companyId, row.objectKey)).exists) throw new Error("restore_point_object_still_present");
        await db.update(executionWorkspaceRestorePoints)
          .set({ status: "deleted", deletedAt: at, lastError: null, updatedAt: at })
          .where(eq(executionWorkspaceRestorePoints.id, row.id));
        result.deleted += 1;
      } catch (error) {
        await db.update(executionWorkspaceRestorePoints)
          .set({ lastError: error instanceof Error ? error.message.slice(0, 500) : "delete_failed", updatedAt: at })
          .where(eq(executionWorkspaceRestorePoints.id, row.id));
        result.failed += 1;
      }
    }
    result.truncated = abandoned.length === batchSize || due.length === batchSize || doomed.length === batchSize;
    return result;
  }

  async function nextDeadlineAt(): Promise<number | null> {
    const [row] = await db.select({
      deleteNow: sql<number>`count(*) FILTER (WHERE ${executionWorkspaceRestorePoints.status} IN ('superseded', 'delete_requested') AND ${executionWorkspaceRestorePoints.lastError} IS NULL)::int`,
      retryFrom: sql<string | null>`min(${executionWorkspaceRestorePoints.updatedAt}) FILTER (WHERE ${executionWorkspaceRestorePoints.status} IN ('superseded', 'delete_requested') AND ${executionWorkspaceRestorePoints.lastError} IS NOT NULL)`,
      pendingFrom: sql<string | null>`min(${executionWorkspaceRestorePoints.createdAt}) FILTER (WHERE ${executionWorkspaceRestorePoints.status} = 'pending')`,
      expiresAt: sql<string | null>`min(${executionWorkspaceRestorePoints.deleteAfter}) FILTER (WHERE ${executionWorkspaceRestorePoints.status} = 'active')`,
      unscheduled: sql<number>`count(*) FILTER (WHERE ${executionWorkspaceRestorePoints.status} = 'active' AND ${executionWorkspaceRestorePoints.deleteAfter} IS NULL)::int`,
    }).from(executionWorkspaceRestorePoints);
    const at = now().getTime();
    const deadlines: number[] = [];
    if (row && (row.deleteNow > 0 || row.unscheduled > 0)) deadlines.push(at);
    if (row?.retryFrom) deadlines.push(new Date(row.retryFrom).getTime() + GIT_RESTORE_POINT_RETRY_MS);
    if (row?.pendingFrom) deadlines.push(new Date(row.pendingFrom).getTime() + pendingGraceMs);
    if (row?.expiresAt) deadlines.push(new Date(row.expiresAt).getTime());
    return deadlines.length > 0 ? Math.min(...deadlines) : null;
  }

  return { tick, nextDeadlineAt };
}

export function notifyGitRestorePointWork(transaction: object, hint?: string) {
  return notifyDeliveryWork(transaction, DELIVERY_QUEUES.gitRestorePoints, hint);
}

export async function requestRestorePointDeletion(
  tx: Pick<Db, "update">,
  scope: { sourceIssueId: string } | { companyId: string },
) {
  await notifyGitRestorePointWork(tx, "sourceIssueId" in scope ? `issue:${scope.sourceIssueId}` : `company:${scope.companyId}`);
  await tx.update(executionWorkspaceRestorePoints)
    .set({ status: "delete_requested", updatedAt: new Date() })
    .where(and(
      "sourceIssueId" in scope
        ? eq(executionWorkspaceRestorePoints.sourceIssueId, scope.sourceIssueId)
        : eq(executionWorkspaceRestorePoints.companyId, scope.companyId),
      inArray(executionWorkspaceRestorePoints.status, ["pending", "active"]),
    ));
}

export function registerGitRestorePointWork(
  coordinator: ReturnType<typeof createDeliveryWorkCoordinator>,
  service: ReturnType<typeof gitRestorePointRetentionService>,
  onResult: (result: GitRestorePointRetentionResult) => void,
) {
  let next: number | null = null;
  return coordinator.register(DELIVERY_QUEUES.gitRestorePoints, {
    retryMs: GIT_RESTORE_POINT_RETRY_MS,
    run: async () => {
      next = null;
      const result = await service.tick();
      onResult(result);
      next = result.truncated ? Date.now() + 1000 : await service.nextDeadlineAt();
    },
    hasPending: async () => false,
    nextRunAt: () => next,
  });
}
