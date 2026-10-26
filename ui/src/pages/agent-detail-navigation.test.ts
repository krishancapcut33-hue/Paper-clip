import { describe, expect, it } from "vitest";
import {
  AGENT_AUDIT_SECTIONS,
  AGENT_DETAIL_NAVIGATION,
  agentDetailHref,
  agentRouteRedirect,
  parseAgentAuditSection,
  agentScopedAuditHref,
  parseAgentDetailView,
} from "./agent-detail-navigation";

describe("agent detail navigation", () => {
  it("exposes the complete local information architecture", () => {
    expect(AGENT_DETAIL_NAVIGATION.flatMap((section) => section.items.map((item) => item.value))).toEqual([
      "overview",
      "instructions",
      "skills",
      "runtime",
      "secrets",
      "tools",
      "channels",
      "permissions",
      "api-keys",
      "revisions",
    ]);
  });

  it("canonicalizes legacy local paths", () => {
    expect(parseAgentDetailView("dashboard")).toBe("overview");
    expect(parseAgentDetailView("configuration")).toBe("runtime");
    expect(parseAgentDetailView("prompts")).toBe("instructions");
    expect(agentDetailHref("codexcoder", "permissions")).toBe("/agents/codexcoder/permissions");
  });

  it("hosts agent-scoped Audit sections under the agent route", () => {
    expect(parseAgentAuditSection("runs")).toBe("runs");
    expect(parseAgentAuditSection("audit")).toBe("activity");
    expect(parseAgentAuditSection("budget")).toBe("budgets");
    expect(agentScopedAuditHref("codexcoder", "activity")).toBe("/agents/codexcoder/activity");
    expect(agentScopedAuditHref("codexcoder", "costs")).toBe("/agents/codexcoder/costs");
  });

  it.each([
    ["activity", "activity"],
    ["audit", "activity"],
    ["runs", "runs"],
    ["cost", "costs"],
    ["costs", "costs"],
    ["budget", "budgets"],
    ["budgets", "budgets"],
  ] as const)("maps the %s tab segment to the %s Audit section", (segment, section) => {
    expect(parseAgentAuditSection(segment)).toBe(section);
  });

  it.each([null, "", "overview", "runtime", "timeline", "commentary", "plugin:test.plugin:insights"])(
    "leaves %j to the agent's own views",
    (segment) => {
      expect(parseAgentAuditSection(segment)).toBeNull();
    },
  );

  describe("agentRouteRedirect", () => {
    const base = {
      routeAgentRef: "codexcoder", canonicalAgentRef: "codexcoder", runId: undefined, tab: "overview",
      view: "overview", auditSection: null, search: "",
    } as const;

    it.each([
      ["an overview page", { ...base }],
      ["a runtime page", { ...base, tab: "runtime", view: "runtime" }],
      ["a canonical Audit section", { ...base, tab: "costs", auditSection: "costs", search: "?x=1" }],
      ["a run detail on the canonical ref", { ...base, tab: undefined, runId: "run-1", view: "run-detail" }],
    ] as const)("leaves %s alone", (_name, input) => {
      expect(agentRouteRedirect(input)).toBeNull();
    });

    it.each([
      ["audit", "activity"],
      ["cost", "costs"],
      ["budget", "budgets"],
    ] as const)("rewrites the legacy %s segment to the %s section and keeps the filters", (tab, section) => {
      expect(agentRouteRedirect({ ...base, tab, auditSection: section, search: "?action=tool_" }))
        .toBe(`/agents/codexcoder/${section}?action=tool_`);
    });

    it("rewrites a non-canonical agent ref for an Audit section without leaving the agent page", () => {
      const target = agentRouteRedirect({ ...base, routeAgentRef: "agent-uuid", tab: "runs", auditSection: "runs", search: "?runStatus=failed" });
      expect(target).toBe("/agents/codexcoder/runs?runStatus=failed");
      expect(target).not.toContain("/activity");
    });

    it("rewrites a non-canonical agent ref for a run detail and a local page", () => {
      expect(agentRouteRedirect({ ...base, routeAgentRef: "agent-uuid", tab: undefined, runId: "run-1", view: "run-detail" }))
        .toBe("/agents/codexcoder/runs/run-1");
      expect(agentRouteRedirect({ ...base, routeAgentRef: "agent-uuid", tab: "runtime", view: "runtime" }))
        .toBe("/agents/codexcoder/runtime");
    });

    it("keeps the query string when it canonicalizes a local tab", () => {
      expect(agentRouteRedirect({ ...base, routeAgentRef: "agent-uuid", tab: "runtime", view: "runtime", search: "?x=1" }))
        .toBe("/agents/codexcoder/runtime?x=1");
    });

    it("canonicalizes legacy local tabs and a missing tab", () => {
      expect(agentRouteRedirect({ ...base, tab: "configuration", view: "runtime" })).toBe("/agents/codexcoder/runtime");
      expect(agentRouteRedirect({ ...base, tab: undefined })).toBe("/agents/codexcoder/overview");
    });
  });

  it("lists exactly the sections the agent route can host, each with a canonical href", () => {
    expect(AGENT_AUDIT_SECTIONS.map((section) => section.value)).toEqual(["activity", "runs", "costs", "budgets"]);
    for (const { value } of AGENT_AUDIT_SECTIONS) {
      // The canonical segment must parse back to the section it was built from.
      expect(parseAgentAuditSection(agentScopedAuditHref("codexcoder", value).split("/").pop() ?? null)).toBe(value);
    }
  });
});
