import { useCallback, useEffect } from "react";
import { History } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageTabBar } from "@/components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { useNavigate, useSearchParams } from "@/lib/router";
import { Costs } from "@/pages/Costs";
import { Timeline } from "@/pages/Timeline";
import { AuditFeed, type AuditFeedMode } from "./AuditFeed";
import { AuditRuns } from "./AuditRuns";
import { AgentCommentary } from "./AgentCommentary";
import { RoutineAuditActivity } from "./RoutineAuditActivity";
import {
  AUDIT_SECTIONS,
  auditScopeFromSearchParams,
  auditSectionHref,
  type AuditSection,
} from "./audit-navigation";

export function AuditHub({
  section,
  agentId,
}: {
  section: AuditSection;
  /**
   * Embedded on an agent page (`/agents/:ref/<section>`): the agent rail is the
   * navigation, so the page owns the title, tabs, and breadcrumbs.
   */
  agentId?: string;
}) {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlScope = auditScopeFromSearchParams(searchParams);
  const scope = agentId ? { ...urlScope, mode: "agents" as const, agentId } : urlScope;
  const mode: AuditFeedMode = scope.mode === "agents" ? "agents" : "all";
  // The routine-only views list every record of a routine and cannot be narrowed to one agent, so an agent
  // page never uses them: Activity falls back to the agent-locked feed, Runs to the agent's own runs.
  const routineId = !agentId && scope.entityType === "routine" ? scope.entityId ?? undefined : undefined;
  const actionParam = searchParams.get("action");
  const actionDomain = [
    "issue.",
    "case.",
    "agent.",
    "heartbeat.",
    "approval.",
    "project.",
    "goal.",
    "tool_",
    "cost.",
    "company.",
  ].includes(actionParam ?? "") ? actionParam! : "__all";

  useEffect(() => {
    if (agentId) return;
    const current = AUDIT_SECTIONS.find((candidate) => candidate.value === section);
    setBreadcrumbs([
      { label: "Audit", href: section === "activity" ? undefined : "/activity" },
      ...(section === "activity" || !current ? [] : [{ label: current.label }]),
    ]);
  }, [agentId, section, setBreadcrumbs]);

  const handleModeChange = useCallback(
    (next: AuditFeedMode) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === "agents") params.set("mode", "agents");
          else params.delete("mode");
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleActionDomainChange = useCallback(
    (next: string) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === "__all") params.delete("action");
          else params.set("action", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleEntityTypeChange = useCallback((next: string) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next === "__all") params.delete("entityType");
      else params.set("entityType", next);
      params.delete("entityId");
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const handleEntityIdChange = useCallback((next: string) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next.trim()) params.set("entityId", next);
      else params.delete("entityId");
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete("action");
      params.delete("entityType");
      params.delete("entityId");
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  if (!selectedCompanyId) {
    return <EmptyState icon={History} message="Select an organization to view Audit." />;
  }

  return (
    <div className="space-y-6">
      {agentId ? null : (
        <>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Audit</h1>
          </div>

          <Tabs
            value={section}
            onValueChange={(value) => {
              const next = value as AuditSection;
              navigate(auditSectionHref(next, scope));
            }}
          >
            <PageTabBar items={AUDIT_SECTIONS} value={section} align="start" />
          </Tabs>
        </>
      )}

      {section === "commentary" ? (
        <AgentCommentary key={selectedCompanyId} companyId={selectedCompanyId} />
      ) : section === "activity" && routineId ? (
        <RoutineAuditActivity companyId={selectedCompanyId} routineId={routineId} />
      ) : section === "activity" ? (
        <AuditFeed
          companyId={selectedCompanyId}
          hideHeader
          mode={mode}
          onModeChange={handleModeChange}
          actionDomain={actionDomain}
          onActionDomainChange={handleActionDomainChange}
          entityType={scope.entityType ?? "__all"}
          onEntityTypeChange={handleEntityTypeChange}
          entityId={scope.entityId ?? ""}
          onEntityIdChange={handleEntityIdChange}
          onClearFilters={handleClearFilters}
          lockedAgentId={scope.agentId ?? undefined}
          lockedRunId={scope.runId ?? undefined}
          lockedEntity={
            scope.entityType && scope.entityId
              ? { type: scope.entityType, id: scope.entityId }
              : undefined
          }
        />
      ) : section === "runs" ? (
        <AuditRuns companyId={selectedCompanyId} routineId={routineId} lockedAgentId={agentId} hideHeader={Boolean(agentId)} />
      ) : section === "budgets" ? (
        <Costs embedded initialTab="budgets" lockTab agentId={agentId} />
      ) : section === "timeline" ? (
        <Timeline embedded />
      ) : (
        <Costs embedded initialTab="overview" hideBudgetsTab hideHeader={Boolean(agentId)} agentId={agentId} />
      )}
    </div>
  );
}
