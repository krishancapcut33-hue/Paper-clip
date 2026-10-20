import type { TaskChatItem, TaskChatMarkerItem, TaskChatMessageItem } from "./task-chat-model";

export function isNoLiveExecutionPathNotice(item: TaskChatMessageItem): boolean {
  if (item.author !== "system") return false;
  // Structured notices identify their own purpose; quoted error text must not
  // turn another system update into a suppressible recovery row.
  if (item.presentation) {
    return item.presentation.title?.trim().toLowerCase() === "no live execution path";
  }
  // Older recovery comments lack presentation metadata. Recognize their own
  // recovery statement rather than any mention of the error phrase.
  return /^Paperclip (?:automatically )?retried (?:dispatch|continuation|this issue's run)\b[^\r\n]*\bit still has no live execution path\b/i.test(item.text.trim());
}

function errorKind(item: TaskChatItem): "run" | "recovery" | null {
  if (item.kind === "marker" && item.variant === "interrupted"
    && item.tone !== "neutral" && !item.credentialAccess) return "run";
  if (item.kind === "message" && isNoLiveExecutionPathNotice(item)) return "recovery";
  return null;
}

/** Keep the last row when adjacent run and recovery errors describe a stop.
 * The caller supplies conversation order; saved comments and run history stay intact.
 * Messages, inputs, session boundaries and actionable credential denials break a group.
 */
export function compactAdjacentErrors(items: readonly TaskChatItem[]): {
  items: TaskChatItem[];
  retryMarkers: Map<string, TaskChatMarkerItem>;
} {
  const result: TaskChatItem[] = [];
  const retryMarkers = new Map<string, TaskChatMarkerItem>();
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
    const latest = items[end - 1];
    if (mixed && errorKind(latest) === "recovery") {
      const marker = items.slice(start, end).reverse().find(
        (item): item is TaskChatMarkerItem => item.kind === "marker"
          && (item.label === "Run failed" || item.label === "Usage limit reached"),
      );
      // Preserve the retry target separately from the surviving error's text.
      // The renderer still applies the parent's permission and pending state.
      if (marker) retryMarkers.set(latest.id, marker);
    }
    result.push(...(mixed ? [latest] : items.slice(start, end)));
    start = end;
  }
  return { items: result, retryMarkers };
}
