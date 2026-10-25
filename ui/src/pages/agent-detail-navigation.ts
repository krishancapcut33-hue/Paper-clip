import type { AuditSection } from "./audit/audit-navigation";

export type AgentDetailView =
  | "overview"
  | "instructions"
  | "skills"
  | "runtime"
  | "secrets"
  | "tools"
  | "channels"
  | "permissions"
  | "api-keys"
  | "revisions"
  | "run-detail";

export type AgentLocalDetailView = Exclude<AgentDetailView, "run-detail">;

export const AGENT_DETAIL_NAVIGATION: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ value: AgentLocalDetailView; label: string }>;
}> = [
  {
    label: "Agent",
    items: [
      { value: "overview", label: "Overview" },
      { value: "instructions", label: "Instructions" },
      { value: "skills", label: "Skills" },
    ],
  },
  {
    label: "Runtime",
    items: [
      { value: "runtime", label: "Harness / Runtime" },
      { value: "secrets", label: "Secrets" },
      { value: "tools", label: "Tools" },
      { value: "channels", label: "Channels" },
    ],
  },
  {
    label: "Governance",
    items: [
      { value: "permissions", label: "Permissions / Trust" },
      { value: "api-keys", label: "API Keys" },
      { value: "revisions", label: "Revisions" },
    ],
  },
] as const;

export function parseAgentDetailView(value: string | null): AgentLocalDetailView {
  if (value === "instructions" || value === "prompts") return "instructions";
  if (value === "skills") return "skills";
  if (value === "runtime" || value === "configure" || value === "configuration") return "runtime";
  if (value === "secrets") return "secrets";
  if (value === "tools") return "tools";
  if (value === "channels") return "channels";
  if (value === "permissions" || value === "trust") return "permissions";
  if (value === "api-keys" || value === "keys") return "api-keys";
  if (value === "revisions" || value === "history") return "revisions";
  return "overview";
}

export function agentDetailHref(agentRef: string, view: AgentLocalDetailView = "overview") {
  return `/agents/${agentRef}/${view}`;
}

/** Audit sections an agent page hosts at `/agents/:ref/<section>`, scoped to that agent. */
export type AgentAuditSection = Extract<AuditSection, "activity" | "runs" | "costs" | "budgets">;

export const AGENT_AUDIT_SECTIONS: ReadonlyArray<{ value: AgentAuditSection; label: string }> = [
  { value: "activity", label: "Activity" },
  { value: "runs", label: "Runs" },
  { value: "costs", label: "Costs" },
  { value: "budgets", label: "Budgets" },
];

/** Maps an agent tab segment (including legacy aliases) onto its Audit section. */
export function parseAgentAuditSection(value: string | null): AgentAuditSection | null {
  if (value === "runs") return "runs";
  if (value === "audit" || value === "activity") return "activity";
  if (value === "cost" || value === "costs") return "costs";
  if (value === "budget" || value === "budgets") return "budgets";
  return null;
}

export function agentScopedAuditHref(agentRef: string, section: AgentAuditSection) {
  return `/agents/${agentRef}/${section}`;
}
