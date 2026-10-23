import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { heartbeatRuns, issues, issueThreadInteractions, type Db } from "@paperclipai/db";
import { hasPublishedGitHubReview } from "../chat-channels/github/review-wait.js";
import { issueThreadInteractionService } from "../issue-thread-interactions.js";
import { logActivity, publishActivity, type ActivityPublication } from "../activity-log.js";

export async function supersedeExternalReviewRequests(db: Db, binding: {
  companyId: string; issueId: string; runId: string; agentId: string;
}) {
  if (!await hasPublishedGitHubReview(db, binding)) return;
  const candidates = await db.select({ interaction: issueThreadInteractions })
    .from(issueThreadInteractions)
    .innerJoin(heartbeatRuns, and(
      eq(heartbeatRuns.id, issueThreadInteractions.sourceRunId),
      eq(heartbeatRuns.companyId, binding.companyId),
      eq(heartbeatRuns.nativeIssueId, binding.issueId),
      eq(heartbeatRuns.agentId, binding.agentId),
    ))
    .innerJoin(issues, and(eq(issues.id, binding.issueId), eq(issues.companyId, binding.companyId),
      eq(issues.assigneeAgentId, binding.agentId), eq(issues.executionRunId, binding.runId)))
    .where(and(
      eq(issueThreadInteractions.companyId, binding.companyId), eq(issueThreadInteractions.issueId, binding.issueId),
      eq(issueThreadInteractions.status, "pending"), eq(issueThreadInteractions.kind, "request_confirmation"),
      ne(issueThreadInteractions.sourceRunId, binding.runId),
      isNull(issueThreadInteractions.createdByAgentId), isNull(issueThreadInteractions.createdByUserId),
      sql`${issueThreadInteractions.idempotencyKey} like 'native-review:%'`,
      sql`${issueThreadInteractions.payload}->'target'->>'key' = 'native_completion_review'`,
    ));
  for (const { interaction } of candidates) {
    if (!await hasPublishedGitHubReview(db, { ...binding, runId: interaction.sourceRunId! })) continue;
    const reason = "A later published review no longer requests human input.";
    const publications: ActivityPublication[] = [];
    await issueThreadInteractionService(db).withdrawInteraction(
      { id: binding.issueId, companyId: binding.companyId }, interaction.id, { reason },
      { agentId: binding.agentId, runId: binding.runId },
      { afterResolveInTransaction: async tx => {
        const [owner] = await tx.select({ id: issues.id }).from(issues).where(and(
          eq(issues.companyId, binding.companyId), eq(issues.id, binding.issueId),
          eq(issues.executionRunId, binding.runId), eq(issues.assigneeAgentId, binding.agentId),
        ));
        if (!owner) throw new Error("external_review_request_owner_changed");
        await logActivity(tx as unknown as Db, { companyId: binding.companyId,
          actorType: "system", actorId: "native-status-committer", runId: binding.runId,
          action: "issue.interaction.withdrawn", entityType: "issue", entityId: binding.issueId,
          details: { interactionId: interaction.id, reason },
        }, publications);
      } },
    );
    for (const publication of publications) publishActivity(publication);
  }
}
