import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TaskInterruptionPresentation } from "@paperclipai/shared";
import type { IssueChatLinkedRun } from "@/lib/issue-chat-messages";
import { CommentSubmissionUnknownError } from "@/lib/comment-submit-result";
import { isTerminalIssueStatus } from "@/lib/liveIssueIds";

interface Submission {
  issueId: string | null;
  agentId: string;
  runIds: Set<string>;
  submittedAt: number;
  interruptionKey: string;
}

export function useRunnerSubmission({
  issueId,
  agentId,
  issueStatus,
  runId,
  linkedRuns = [],
  interruption,
  onRefresh,
}: {
  issueId: string | null;
  agentId: string | null;
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
  const settled = Boolean(submission && (
    runId || isTerminalIssueStatus(issueStatus) ||
    submission.agentId !== agentId ||
    (submission.issueId && submission.issueId !== issueId) ||
    (interruption && interruption.state !== "working" &&
      interruptionKey !== submission.interruptionKey &&
      (interruption.intentId !== null ||
        (interruption.observedRunId !== null &&
          linkedRuns.some(run => run.runId === interruption.observedRunId &&
            new Date(run.createdAt).getTime() >= submission.submittedAt)))) ||
    linkedRuns.some(run => run.agentId === submission.agentId &&
      !submission.runIds.has(run.runId) &&
      new Date(run.createdAt).getTime() >= submission.submittedAt &&
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

  const begin = useCallback(() => {
    const next: Submission | null = agentId ? {
      issueId, agentId, interruptionKey, submittedAt: Date.now(),
      runIds: new Set(linkedRuns.map(run => run.runId)),
    } : null;
    setSubmission(next);
    setTakingLonger(false);
    return next;
  }, [agentId, issueId, interruptionKey, linkedRuns]);

  const reject = useCallback((attempt: Submission | null, error: unknown) => {
    setSubmission(current => current === attempt &&
      !(error instanceof CommentSubmissionUnknownError) ? null : current);
    if (error instanceof CommentSubmissionUnknownError) setTakingLonger(true);
  }, []);

  return { pending, takingLonger, begin, reject };
}
