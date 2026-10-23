import { and, eq, inArray } from "drizzle-orm";
import { chatConversations, chatEndpoints, heartbeatRuns, issues, statusDecisions, type Db } from "@paperclipai/db";

export async function listExternalReviewWaits(db: Db, companyId: string, issueIds: string[]) {
  if (!issueIds.length) return [];
  return db.select({
    id: statusDecisions.id,
    companyId: issues.companyId,
    issueId: issues.id,
    status: chatConversations.state,
    createdAt: statusDecisions.createdAt,
  }).from(issues)
    .innerJoin(statusDecisions, and(
      eq(statusDecisions.id, issues.lastStatusDecisionId),
      eq(statusDecisions.companyId, issues.companyId),
      eq(statusDecisions.issueId, issues.id),
      eq(statusDecisions.applicationState, "applied"),
      eq(statusDecisions.toStatus, "in_review"),
      eq(statusDecisions.reasonCode, "external_chat_response_waiting"),
    ))
    .innerJoin(heartbeatRuns, and(
      eq(heartbeatRuns.id, statusDecisions.runId),
      eq(heartbeatRuns.companyId, issues.companyId),
      eq(heartbeatRuns.nativeIssueId, issues.id),
      eq(heartbeatRuns.agentId, issues.assigneeAgentId),
      eq(heartbeatRuns.status, "succeeded"),
    ))
    .innerJoin(chatConversations, and(
      eq(chatConversations.companyId, issues.companyId),
      eq(chatConversations.issueId, issues.id),
      inArray(chatConversations.state, ["active", "waiting"]),
    ))
    .innerJoin(chatEndpoints, and(
      eq(chatEndpoints.id, chatConversations.endpointId),
      eq(chatEndpoints.companyId, issues.companyId),
      eq(chatEndpoints.assignedAgentId, issues.assigneeAgentId),
      eq(chatEndpoints.status, "active"),
    ))
    .where(and(eq(issues.companyId, companyId), inArray(issues.id, issueIds), eq(issues.status, "in_review")));
}
