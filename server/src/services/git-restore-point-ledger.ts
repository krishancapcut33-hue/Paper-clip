import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { executionWorkspaceRestorePoints, type Db } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";

export const GIT_RESTORE_POINT_RETENTION_INTERVAL_MS = 60 * 60 * 1000;
export const GIT_RESTORE_POINT_RETENTION_STARTUP_DELAY_MS = 3 * 60 * 1000;
export const GIT_RESTORE_POINT_DEFAULT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PENDING_GRACE_MS = 60 * 60 * 1000;
const DEFAULT_BATCH = 50;

type RestorePoint = typeof executionWorkspaceRestorePoints.$inferSelect;

export type GitRestorePointRetentionResult = {
  abandoned: number;
  scheduled: number;
  expired: number;
  orphaned: number;
  deleted: number;
  failed: number;
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

  async function tick(): Promise<GitRestorePointRetentionResult> {
    const at = now();
    const result: GitRestorePointRetentionResult = { abandoned: 0, scheduled: 0, expired: 0, orphaned: 0, deleted: 0, failed: 0 };

    const abandoned = await db.select({ id: executionWorkspaceRestorePoints.id }).from(executionWorkspaceRestorePoints)
      .where(and(eq(executionWorkspaceRestorePoints.status, "pending"),
        lt(executionWorkspaceRestorePoints.createdAt, new Date(at.getTime() - pendingGraceMs))))
      .orderBy(asc(executionWorkspaceRestorePoints.createdAt)).limit(batchSize);
    await requestDeletion(abandoned.map((row) => row.id), at);
    result.abandoned = abandoned.length;

    const active = await db.select().from(executionWorkspaceRestorePoints)
      .where(eq(executionWorkspaceRestorePoints.status, "active"))
      .orderBy(asc(executionWorkspaceRestorePoints.updatedAt), asc(executionWorkspaceRestorePoints.id)).limit(batchSize);
    for (const row of active) {
      const tree = await issueTreeState(row);
      if (!tree.exists) {
        await requestDeletion([row.id], at);
        result.orphaned += 1;
        continue;
      }
      const deleteAfter = tree.open || !tree.closedAt ? null : new Date(tree.closedAt.getTime() + retentionMs);
      if (deleteAfter && deleteAfter.getTime() <= at.getTime()) {
        await options.beforeExpire?.(row);
        await requestDeletion([row.id], at);
        result.expired += 1;
        continue;
      }
      await db.update(executionWorkspaceRestorePoints)
        .set({ treeClosedAt: tree.open ? null : tree.closedAt, deleteAfter, updatedAt: at })
        .where(and(eq(executionWorkspaceRestorePoints.id, row.id), eq(executionWorkspaceRestorePoints.status, "active")));
      result.scheduled += 1;
    }

    const doomed = await db.select().from(executionWorkspaceRestorePoints)
      .where(or(eq(executionWorkspaceRestorePoints.status, "superseded"), eq(executionWorkspaceRestorePoints.status, "delete_requested")))
      .orderBy(asc(executionWorkspaceRestorePoints.updatedAt), asc(executionWorkspaceRestorePoints.id)).limit(batchSize);
    for (const row of doomed) {
      try {
        await options.storage.deleteObject(row.companyId, row.objectKey);
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
    return result;
  }

  return { tick };
}
