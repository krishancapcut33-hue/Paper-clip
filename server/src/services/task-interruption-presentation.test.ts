import { describe, expect, it } from "vitest";
import { projectTaskInterruption } from "./task-interruption-presentation.js";

const issue = { id: "task", companyId: "11111111-1111-4111-8111-111111111111", status: "blocked", assigneeAgentId: "agent", projectId: "22222222-2222-4222-8222-222222222222" };
const run = { id: "run", agentId: "agent", status: "failed", scheduledRetryAt: null,
  errorCode: "project_access_denied", error: null, livenessState: null,
  resultJson: { projectAccessDenied: { projectId: "22222222-2222-4222-8222-222222222222" } } };
const agent = { status: "idle", pauseReason: null, permissions: {
  trustPreset: "low_trust_review", authorizationPolicy: { trustBoundary: {
    mode: "low_trust_review", companyId: "11111111-1111-4111-8111-111111111111", projectIds: ["33333333-3333-4333-8333-333333333333"],
  } },
} };

describe("task project-access interruption", () => {
  it("explains a project denial without offering a futile retry", () => {
    expect(projectTaskInterruption(issue, { run, agent, paused: false, approval: false })).toMatchObject({
      state: "waiting_for_user", responsibility: "user", userAction: "project_access", canRetry: false,
      projectAccess: { agentId: "agent", projectId: "22222222-2222-4222-8222-222222222222", ready: false },
    });
  });

  it("projects the historical setup denial without requiring another failed run", () => {
    expect(projectTaskInterruption(issue, { run: { ...run, errorCode: "setup_failed",
      error: "Project is outside this low-trust boundary.", resultJson: null }, agent, paused: false, approval: false }))
      .toMatchObject({ userAction: "project_access", canRetry: false });
  });

  it("offers an explicit retry after the project is added, without changing the failed run", () => {
    const permissions = structuredClone(agent.permissions);
    permissions.authorizationPolicy.trustBoundary.projectIds.push("22222222-2222-4222-8222-222222222222");
    expect(projectTaskInterruption(issue, { run, agent: { ...agent, permissions }, paused: false, approval: false }))
      .toMatchObject({ state: "failed", canRetry: true, projectAccess: { ready: true } });
    expect(run.status).toBe("failed");
  });

  it("does not reinterpret unrelated failures or an old assignee's denial", () => {
    for (const otherRun of [{ ...run, errorCode: "setup_failed", error: "Disk full", resultJson: null },
      { ...run, agentId: "previous-agent" }]) {
      expect(projectTaskInterruption(issue, { run: otherRun, agent, paused: false, approval: false }))
        .not.toHaveProperty("projectAccess");
    }
  });

  it("keeps approval, pause, running and completed states authoritative", () => {
    expect(projectTaskInterruption(issue, { run, agent, paused: false, approval: true })).toMatchObject({ userAction: "approval" });
    expect(projectTaskInterruption(issue, { run, agent, paused: true, approval: false })).toMatchObject({ userAction: "resume" });
    expect(projectTaskInterruption(issue, { run: { ...run, status: "running" }, agent, paused: false, approval: false }))
      .toMatchObject({ state: "working" });
    expect(projectTaskInterruption({ ...issue, status: "done" }, { run, agent, paused: false, approval: false }))
      .toMatchObject({ state: "resolved" });
  });
});
