import { z } from "zod";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { agentWakeupRequests, chatActions, chatConversations, chatEndpoints, type Db } from "@paperclipai/db";
import type { DbOrTransaction } from "./runtime-types.js";

export const taskRetryInputSchema = z.object({
  sourceActionIds: z.array(z.string().uuid()).max(50).refine(ids => new Set(ids).size === ids.length),
  runtimeFence: z.object({ generation: z.number().int().nonnegative(),
    credentialFingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
});
export type TaskRetryInput = z.infer<typeof taskRetryInputSchema>;

export async function selectTaskRetryInput(tx: DbOrTransaction, input: { companyId: string; issueId: string; agentId: string }) {
  const [conversation] = await tx.select({ id: chatConversations.id }).from(chatConversations)
    .innerJoin(chatEndpoints, eq(chatEndpoints.id, chatConversations.endpointId)).where(and(
      eq(chatConversations.companyId, input.companyId), eq(chatConversations.issueId, input.issueId),
      eq(chatEndpoints.provider, "github"), eq(chatEndpoints.assignedAgentId, input.agentId),
      eq(chatEndpoints.externalExecutionPolicy, "restricted"),
    )).limit(1);
  if (!conversation) return undefined;
  const pending = await tx.select({ id: chatActions.id }).from(chatActions)
    .innerJoin(agentWakeupRequests, and(eq(agentWakeupRequests.companyId, chatActions.companyId),
      eq(agentWakeupRequests.id, chatActions.id))).where(and(
      eq(chatActions.companyId, input.companyId), eq(chatActions.conversationId, conversation.id),
      eq(chatActions.kind, "inbound_wakeup"), eq(chatActions.status, "processed"),
      eq(agentWakeupRequests.agentId, input.agentId), eq(agentWakeupRequests.status, "deferred_issue_execution"),
      isNull(agentWakeupRequests.runId),
    )).orderBy(asc(chatActions.createdAt), asc(chatActions.id)).limit(51).for("update", { of: agentWakeupRequests });
  return taskRetryInputSchema.parse({ sourceActionIds: pending.map(row => row.id) });
}

export async function claimTaskRetryInput(tx: DbOrTransaction, input: {
  companyId: string; retryActionId: string; sourceActionIds: string[];
}) {
  if (!input.sourceActionIds.length) return;
  await tx.update(agentWakeupRequests).set({ status: "coalesced", updatedAt: new Date(),
    payload: sql`coalesce(${agentWakeupRequests.payload}, '{}'::jsonb) || ${JSON.stringify({
      coalescedIntoWakeupRequestId: input.retryActionId })}::jsonb`,
  }).where(and(eq(agentWakeupRequests.companyId, input.companyId),
    inArray(agentWakeupRequests.id, input.sourceActionIds), eq(agentWakeupRequests.status, "deferred_issue_execution"),
    isNull(agentWakeupRequests.runId)));
}

export async function settleTaskRetryInput(tx: DbOrTransaction, input: { companyId: string; retryActionId: string; runId: string | null }) {
  if (!input.runId) return;
  await tx.update(agentWakeupRequests).set({ runId: input.runId, updatedAt: new Date() }).where(and(
    eq(agentWakeupRequests.companyId, input.companyId), eq(agentWakeupRequests.status, "coalesced"),
    isNull(agentWakeupRequests.runId),
    sql`${agentWakeupRequests.payload}->>'coalescedIntoWakeupRequestId' = ${input.retryActionId}`,
  ));
}

export async function releaseUnadmittedTaskRetryInput(db: Db, input: { companyId: string; retryActionId: string }) {
  await db.transaction(async tx => {
    const [action] = await tx.select().from(chatActions).where(and(eq(chatActions.companyId, input.companyId),
      eq(chatActions.id, input.retryActionId), eq(chatActions.kind, "failed_run_retry"),
      inArray(chatActions.status, ["failed", "cancelled"]))).for("update");
    if (!action || typeof action.payload.taskRetryIntentId !== "string") return;
    const [receipt] = await tx.select({ runId: agentWakeupRequests.runId }).from(agentWakeupRequests).where(and(
      eq(agentWakeupRequests.companyId, input.companyId), eq(agentWakeupRequests.id, input.retryActionId),
    )).for("update");
    if (receipt?.runId) return;
    await tx.update(agentWakeupRequests).set({ status: "deferred_issue_execution", finishedAt: null,
      payload: sql`${agentWakeupRequests.payload} - 'coalescedIntoWakeupRequestId'`, updatedAt: new Date(),
    }).where(and(eq(agentWakeupRequests.companyId, input.companyId), eq(agentWakeupRequests.status, "coalesced"),
      isNull(agentWakeupRequests.runId),
      sql`${agentWakeupRequests.payload}->>'coalescedIntoWakeupRequestId' = ${input.retryActionId}`));
    await tx.update(agentWakeupRequests).set({ status: "failed", finishedAt: new Date(), updatedAt: new Date() }).where(and(
      eq(agentWakeupRequests.companyId, input.companyId), eq(agentWakeupRequests.id, action.payload.taskRetryIntentId),
      eq(agentWakeupRequests.reason, "task_retry"), isNull(agentWakeupRequests.runId),
      sql`${agentWakeupRequests.payload}#>>'{taskRetry,chatActionId}' = ${action.id}`,
    ));
  });
}
