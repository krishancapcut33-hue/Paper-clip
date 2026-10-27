import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AgentStatus, TaskInterruptionPresentation } from "@paperclipai/shared";
import type { IssueChatComment, IssueChatLinkedRun } from "@/lib/issue-chat-messages";
import { CommentSubmissionUnknownError } from "@/lib/comment-submit-result";
import { isTerminalIssueStatus } from "@/lib/liveIssueIds";

interface Submission {
  issueId: string | null;
  agentId: string;
  runIds: Set<string>;
  clientRequestId: string;
  interruptionKey: string;
}

export function useRunnerSubmission({
  issueId,
  agentId,
  agentStatus,
  blocked = false,
  comments,
  issueStatus,
  runId,
  linkedRuns = [],
  interruption,
  onRefresh,
}: {
  issueId: string | null;
  agentId: string | null;
  agentStatus?: AgentStatus;
  blocked?: boolean;
  comments: readonly IssueChatComment[];
  issueStatus?: string;
  runId: string | null;
  linkedRuns?: readonly IssueChatLinkedRun[];
  interruption?: TaskInterruptionPresentation | null;
  onRefresh?: () => void | Promise<unknown>;
}) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [takingLonger, setTakingLonger] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const interruptionKey = JSON.stringify([
    interruption?.intentId, interruption?.state, interruption?.observedRunId,
  ]);
  const startupBlocked = blocked || agentStatus === "paused" ||
    agentStatus === "pending_approval" || agentStatus === "terminated";
  const savedComment = submission && comments.find(comment =>
    comment.clientRequestId === submission.clientRequestId && !comment.clientStatus);
  const acknowledgedAt = savedComment ? new Date(savedComment.createdAt).getTime() : null;
  const submissionRuns = submission && savedComment ? linkedRuns.filter(run =>
    run.agentId === submission.agentId && (
      run.runId === savedComment.consumedByRunId || run.runId === savedComment.steeredIntoRunId ||
      (!submission.runIds.has(run.runId) && acknowledgedAt !== null &&
        new Date(run.createdAt).getTime() >= acknowledgedAt)
    )) : [];
  const settled = Boolean(submission && (
    runId || startupBlocked || isTerminalIssueStatus(issueStatus) ||
    submission.agentId !== agentId ||
    (submission.issueId && submission.issueId !== issueId) ||
    (interruption && interruption.state !== "working" &&
      interruptionKey !== submission.interruptionKey &&
      (interruption.intentId !== null ||
        submissionRuns.some(run => run.runId === interruption.observedRunId))) ||
    submissionRuns.some(run =>
      run.status !== "queued" && run.status !== "running")
  ));
  const pending = submission !== null && !settled;

  useLayoutEffect(() => {
    if (settled) {
      setSubmission(null);
      setTakingLonger(false);
    }
  }, [settled]);

  useEffect(() => {
    if (!pending) return;
    const timeout = window.setTimeout(() => {
      setTakingLonger(true);
      void refreshRef.current?.();
    }, 10_000);
    return () => window.clearTimeout(timeout);
  }, [pending, submission]);

  const begin = useCallback((clientRequestId: string) => {
    const next: Submission | null = agentId && !startupBlocked ? {
      issueId, agentId, interruptionKey, clientRequestId,
      runIds: new Set(linkedRuns.map(run => run.runId)),
    } : null;
    setSubmission(next);
    setTakingLonger(false);
    return next;
  }, [agentId, issueId, interruptionKey, linkedRuns, startupBlocked]);

  const reject = useCallback((attempt: Submission | null, error: unknown) => {
    setSubmission(current => current === attempt &&
      !(error instanceof CommentSubmissionUnknownError) ? null : current);
    if (error instanceof CommentSubmissionUnknownError) setTakingLonger(true);
  }, []);

  return { pending, takingLonger, begin, reject, blocked: startupBlocked };
}
