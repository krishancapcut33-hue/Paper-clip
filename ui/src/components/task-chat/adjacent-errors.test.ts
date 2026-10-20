import { describe, expect, it } from "vitest";
import { compactAdjacentErrors } from "./adjacent-errors";
import type { TaskChatItem, TaskChatMarkerItem, TaskChatMessageItem } from "./task-chat-model";

const failed: TaskChatMarkerItem = {
  id: "failure", kind: "marker", variant: "interrupted", label: "Run failed", runId: "run-1",
};
const recovery: TaskChatMessageItem = {
  id: "recovery", kind: "message", author: "system", text: "Paperclip retried continuation, but it still has no live execution path.",
  presentation: { kind: "system_notice", title: "No live execution path", tone: "danger", detailsDefaultOpen: false },
};

describe("compactAdjacentErrors", () => {
  it.each([
    [failed, recovery],
    [recovery, failed],
  ])("keeps the later row and all of its details in either order", (first, last) => {
    const items = [first, last];
    expect(compactAdjacentErrors(items)).toEqual([last]);
    expect(items).toEqual([first, last]);
  });

  it("compacts a contiguous group only when both error sources are present", () => {
    const latest = { ...failed, id: "latest", detail: "Newest error", runId: "run-2" };
    expect(compactAdjacentErrors([failed, recovery, latest])).toEqual([latest]);
    expect(compactAdjacentErrors([failed, latest])).toEqual([failed, latest]);
    expect(compactAdjacentErrors([recovery, { ...recovery, id: "other" }])).toHaveLength(2);
  });

  it("recognizes old unstructured recovery comments", () => {
    expect(compactAdjacentErrors([failed, { ...recovery, presentation: null }])).toEqual([{ ...recovery, presentation: null }]);
  });

  const boundaries: TaskChatItem[] = [
    { id: "human", kind: "message", author: "human", text: "Please try again." },
    { id: "agent", kind: "message", author: "agent", text: "There is no live execution path." },
    { id: "system", kind: "message", author: "system", text: "Child task completed." },
    { id: "session", kind: "marker", variant: "session_start", label: "Session reset" },
    { ...failed, id: "cancelled", tone: "neutral", label: "Stopped" },
    { ...failed, id: "credential", credentialAccess: { agentName: "Coder", deniedUser: "you", settingsHref: "/agents/coder" } },
    { id: "tool", kind: "tool", name: "Read file", status: "completed" },
  ];
  it.each(boundaries.map((boundary) => [boundary.id, boundary] as const))(
    "keeps both errors across a %s row", (_, boundary) => {
      const items = [failed, boundary, recovery];
      expect(compactAdjacentErrors(items)).toEqual(items);
    },
  );
});
