import type { TaskChatItem } from "./task-chat-model";

function errorKind(item: TaskChatItem): "run" | "recovery" | null {
  if (item.kind === "marker" && item.variant === "interrupted"
    && item.tone !== "neutral" && !item.credentialAccess) return "run";
  if (item.kind === "message" && item.author === "system"
    && (item.presentation?.title?.trim().toLowerCase() === "no live execution path"
      || item.text.toLowerCase().includes("no live execution path"))) return "recovery";
  return null;
}

/** Keep the last row when adjacent run and recovery errors describe a stop.
 * The caller supplies conversation order; saved comments and run history stay intact.
 * Messages, inputs, session boundaries and actionable credential denials break a group.
 */
export function compactAdjacentErrors(items: readonly TaskChatItem[]): TaskChatItem[] {
  const result: TaskChatItem[] = [];
  for (let start = 0; start < items.length;) {
    const kind = errorKind(items[start]);
    if (!kind) {
      result.push(items[start++]);
      continue;
    }
    let end = start + 1;
    let mixed = false;
    while (end < items.length) {
      const next = errorKind(items[end]);
      if (!next) break;
      if (next !== kind) mixed = true;
      end++;
    }
    result.push(...(mixed ? [items[end - 1]] : items.slice(start, end)));
    start = end;
  }
  return result;
}
