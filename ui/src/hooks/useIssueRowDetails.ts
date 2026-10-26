import { useEffect, useMemo, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Issue } from "@paperclipai/shared";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";

/** Enrich visible rows without replacing the index that owns membership and order. */
export function mergeIssueRowDetails(issue: Issue, details: Issue | undefined): Issue {
  if (!details || details.id !== issue.id || details.companyId !== issue.companyId
    || new Date(details.updatedAt).getTime() !== new Date(issue.updatedAt).getTime()) return issue;
  return {
    ...issue,
    blockerAttention: details.blockerAttention,
    reviewAttention: details.reviewAttention,
    activeRecoveryAction: details.activeRecoveryAction,
    interruption: details.interruption,
    successfulRunHandoff: details.successfulRunHandoff,
    scheduledRetry: details.scheduledRetry,
  };
}

export function useIssueRowDetails(
  companyId: string | null | undefined,
  root: RefObject<HTMLElement | null>,
  rowIdentity: string,
  enabled: boolean,
) {
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [saved, setSaved] = useState<{ companyId: string; rows: Map<string, Issue> } | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!enabled || !element) {
      setVisibleIds([]);
      return;
    }
    const nodes = [...element.querySelectorAll<HTMLElement>("[data-issue-row-details]")];
    const visible = new Set<string>();
    const publish = () => {
      const next = [...visible].sort().slice(0, 50);
      setVisibleIds((previous) => previous.join(",") === next.join(",") ? previous : next);
    };
    if (typeof IntersectionObserver === "undefined") {
      for (const node of nodes.slice(0, 50)) visible.add(node.dataset.issueRowDetails!);
      publish();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.issueRowDetails!;
        if (entry.isIntersecting) visible.add(id);
        else visible.delete(id);
      }
      publish();
    });
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [companyId, root, rowIdentity, enabled]);

  const { data, error, refetch } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId ?? "__disabled__"), "visible-row-details", visibleIds],
    queryFn: ({ signal }) => issuesApi.listCompact(companyId!, {
      ids: visibleIds, projection: "rows", includeRoutineExecutions: true, limit: 50,
    }, { signal }),
    enabled: enabled && !!companyId && visibleIds.length > 0,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (!companyId || !data) return;
    setSaved((previous) => {
      const rows = new Map(previous?.companyId === companyId ? previous.rows : []);
      for (const issue of data) rows.set(issue.id, issue as Issue);
      return { companyId, rows };
    });
  }, [companyId, data]);
  const enrichIssueRow = useMemo(() => (issue: Issue) => mergeIssueRowDetails(
    issue, saved && saved.companyId === companyId ? saved.rows.get(issue.id) : undefined,
  ), [companyId, saved]);
  return { enrichIssueRow, error, retry: refetch };
}
