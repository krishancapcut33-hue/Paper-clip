import type { Issue } from "@paperclipai/shared";

/** Context never promotes an unrelated or orphaned automated task to a result. */
export function includeIssueHierarchyContext(matches: Issue[], context: Issue[]): Issue[] {
  const byId = new Map([...context, ...matches].map((issue) => [issue.id, issue]));
  const result = new Map(matches.map((issue) => [issue.id, issue]));
  for (const match of matches) {
    const visited = new Set([match.id]);
    let parentId = match.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      result.set(parent.id, parent);
      parentId = parent.parentId;
    }
  }
  // Descendants are rooted at matches, not at contextual ancestors.
  const descendantIds = new Set(matches.map((issue) => issue.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const issue of context) {
      if (!descendantIds.has(issue.id) && issue.parentId && descendantIds.has(issue.parentId)) {
        descendantIds.add(issue.id);
        result.set(issue.id, issue);
        changed = true;
      }
    }
  }
  return [...result.values()];
}

/** Batch each breadth-first frontier; leaf-heavy lists need one read, not one per task. */
export async function loadIssueHierarchyChildren(
  companyId: string,
  matches: Issue[],
  collapsedParents: string[],
  rowBudget: number,
  readChildren: (parentIds: string[], limit: number, offset: number) => Promise<Issue[]>,
): Promise<{ issues: Issue[]; hasMore: boolean }> {
  const context: Issue[] = [];
  const visited = new Set<string>();
  const fetched = new Set<string>();
  const collapsed = new Set(collapsedParents);
  let requests = 0;
  let frontier = [...new Set(matches.map((issue) => issue.id))];
  while (frontier.length > 0 && context.length < rowBudget) {
    const next: string[] = [];
    for (let start = 0; start < frontier.length; start += 100) {
      const parentIds = frontier.slice(start, start + 100).filter((id) => !visited.has(id));
      if (parentIds.length === 0) continue;
      parentIds.forEach((id) => visited.add(id));
      let offset = 0;
      while (context.length < rowBudget) {
        if (requests >= rowBudget) return { issues: context, hasMore: true };
        requests += 1;
        const limit = Math.min(100, rowBudget - context.length);
        const rows = await readChildren(parentIds, limit, offset);
        for (const child of rows) {
          if (child.companyId !== companyId || fetched.has(child.id)) continue;
          fetched.add(child.id);
          context.push(child);
          if (!collapsed.has(child.parentId ?? "") && !visited.has(child.id)) next.push(child.id);
        }
        if (rows.length < limit) break;
        offset += rows.length;
        if (context.length >= rowBudget) return { issues: context, hasMore: true };
      }
      if (context.length >= rowBudget && (start + 100 < frontier.length || next.length > 0)) return { issues: context, hasMore: true };
    }
    frontier = [...new Set(next)].filter((id) => !visited.has(id));
  }
  return { issues: context, hasMore: frontier.length > 0 };
}
