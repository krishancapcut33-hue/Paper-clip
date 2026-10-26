import { and, eq } from "drizzle-orm";
import { chatActions, chatConversations, chatDeliveries, chatEndpointResources, toolConnections } from "@paperclipai/db";
import { forbidden } from "../../../errors.js";
import type { DbOrTransaction, EndpointRow, LifecycleRuntimeFence } from "../runtime-types.js";
import { credentialFingerprint } from "../credential-fingerprint.js";
import { readTaskChatRetryIntent } from "../task-retry-authority.js";

export type TaskRetryWakeAuthority = {
  intentId: string;
  sourceRunId: string;
  runtimeFence?: LifecycleRuntimeFence;
};

export function githubTaskRetryDestinationMatches(delivery: typeof chatDeliveries.$inferSelect,
  conversation: typeof chatConversations.$inferSelect, resource: typeof chatEndpointResources.$inferSelect | null) {
  const originalResource = delivery.normalizedEvent.resource as { providerResourceId?: unknown } | undefined;
  const originalThread = delivery.normalizedEvent.conversation as { externalThreadId?: unknown } | undefined;
  const automatic = (delivery.normalizedEvent.githubAutomatic ?? delivery.normalizedEvent.githubIssue) as
    { context?: { repositoryId?: unknown } } | undefined;
  return resource && originalResource?.providerResourceId === resource.providerResourceId
    && originalThread?.externalThreadId === conversation.externalThreadId
    && (automatic?.context?.repositoryId === undefined
      || automatic.context.repositoryId === resource.metadata.providerRepositoryId);
}

export async function githubTaskRetryRuntimeFence(tx: DbOrTransaction, endpoint: EndpointRow,
  action: typeof chatActions.$inferSelect, delivery: typeof chatDeliveries.$inferSelect,
  authority: TaskRetryWakeAuthority): Promise<LifecycleRuntimeFence> {
  const deny = () => forbidden("This accepted chat message is no longer authorized to start work",
    { code: "chat_action_authorization_changed" });
  const retry = await readTaskChatRetryIntent(tx as Parameters<typeof readTaskChatRetryIntent>[0], {
    companyId: action.companyId, issueId: String(action.payload.issueId),
    agentId: String(action.payload.agentId), sourceRunId: authority.sourceRunId, intentId: authority.intentId,
  });
  if (!retry || endpoint.provider !== "github" || !endpoint.botExternalId || action.kind !== "inbound_wakeup"
    || action.status !== "processed" || delivery.state !== "processed") throw deny();
  const [response] = await tx.select({ payload: chatActions.payload }).from(chatActions).where(and(
    eq(chatActions.companyId, action.companyId), eq(chatActions.endpointId, endpoint.id),
    eq(chatActions.conversationId, action.conversationId!), eq(chatActions.deliveryId, delivery.id),
    eq(chatActions.kind, "github_response_comment"),
  ));
  const original = delivery.normalizedEvent.githubAuthority as { botExternalId?: unknown } | undefined;
  const sameBot = original?.botExternalId !== undefined
    ? original.botExternalId === endpoint.botExternalId
    : response?.payload.botExternalId === endpoint.botExternalId && response.payload.agentId === endpoint.assignedAgentId;
  if (!sameBot) throw deny();
  const [connection] = await tx.select({ refs: toolConnections.credentialSecretRefs,
    enabled: toolConnections.enabled, status: toolConnections.status }).from(toolConnections).where(and(
    eq(toolConnections.companyId, endpoint.companyId), eq(toolConnections.id, endpoint.connectionId),
  ));
  if (!connection?.enabled || connection.status !== "active") throw deny();
  const generation = Number((endpoint.setup as { runtimeGeneration?: unknown }).runtimeGeneration ?? 0);
  if (!Number.isSafeInteger(generation) || generation < 0) throw deny();
  return authority.runtimeFence ?? { generation, credentialFingerprint: credentialFingerprint(connection.refs ?? []) };
}
