import { describe, expect, it } from "vitest";
import {
  AGENT_AUDIT_SECTIONS,
  AGENT_DETAIL_NAVIGATION,
  agentDetailHref,
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

  it("lists exactly the sections the agent route can host, each with a canonical href", () => {
    expect(AGENT_AUDIT_SECTIONS.map((section) => section.value)).toEqual(["activity", "runs", "costs", "budgets"]);
    for (const { value } of AGENT_AUDIT_SECTIONS) {
      // The canonical segment must parse back to the section it was built from.
      expect(parseAgentAuditSection(agentScopedAuditHref("codexcoder", value).split("/").pop() ?? null)).toBe(value);
    }
  });
});
