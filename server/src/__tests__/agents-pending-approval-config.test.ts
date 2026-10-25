import { createAgentLifecycle } from "../services/agent-lifecycle.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  agents,
  approvals,
  activityLog,
  budgetPolicies,
  companies,
  authUsers,
  companyMemberships,
  createDb,
  principalPermissionGrants,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { agentService } from "../services/agents.ts";
import { approvalService } from "../services/approvals.ts";
import { paperclipRunnerSupportsPlatform } from "@paperclipai/shared";
import { NEW_STANDARD_AGENT_DEFAULT_GRANT_KEYS } from "../lib/agent-permissions.js";
import { agentInstructionsService } from "../services/agent-instructions.js";
import { agentInstructionRevisionService } from "../services/agent-instruction-revisions.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function issuePrefix(id: string) {
  return `T${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres pending approval agent tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("pending approval agent config integrity", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-pending-agent-config-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(principalPermissionGrants);
    await db.delete(budgetPolicies);
    await db.delete(approvals);
    await db.delete(companyMemberships);
    await db.delete(authUsers);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompany() {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: issuePrefix(companyId),
      requireBoardApprovalForNewAgents: true,
    });
    return companyId;
  }

  async function seedApprover(companyId: string) {
    await db.insert(authUsers).values({ id: "board-user", name: "Board member", email: "board-user@example.test", createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
    await db.insert(companyMemberships).values({ companyId, principalType: "user", principalId: "board-user", status: "active", membershipRole: "member" });
  }

  it("resolves internal Codex creation once and preserves legacy agents through ordinary edits", async () => {
    const companyId = await seedCompany();
    const service = agentService(db);
    const lifecycle = createAgentLifecycle(db);
    const native = await lifecycle.requestHire(companyId, { name: "New Codex", adapterType: "codex_local", adapterConfig: { modelReasoningEffort: "high" }, status: "pending_approval" });
    const legacy = await lifecycle.requestHire(companyId, { name: "Legacy Codex", adapterType: "codex_local", runner: "legacy", adapterConfig: { extraArgs: ["--search"] }, status: "pending_approval" });
    const reviewedLegacy = await lifecycle.requestHire(companyId, { name: "Historical approved hire", adapterType: "codex_local", adapterConfig: {}, status: "pending_approval" }, { runnerResolved: true });
    if (paperclipRunnerSupportsPlatform("codex_local", process.platform, process.arch)) {
      expect(native).toMatchObject({ adapterType: "paperclip_runner", adapterConfig: { provider: "codex", modelReasoningEffort: "high" } });
    } else {
      expect(native).toMatchObject({ adapterType: "codex_local", adapterConfig: { modelReasoningEffort: "high" } });
    }
    expect(legacy.adapterType).toBe("codex_local");
    expect(reviewedLegacy.adapterType).toBe("codex_local");
    for (const agent of [native, legacy, reviewedLegacy]) {
      expect(agent).not.toHaveProperty("runner");
      await lifecycle.approveHire(agent.id);
      await service.update(agent.id, { title: "Updated title" });
      const saved = await service.getById(agent.id);
      expect(saved?.adapterType).toBe(agent.adapterType);
      expect(saved?.adapterConfig).toEqual(agent.adapterConfig);
    }
  });

  it("freezes generic pending hire config and reapplies the approval snapshot on activation", async () => {
    const companyId = await seedCompany();
    const agentSvc = agentService(db);
    const agentSvcLifecycle = createAgentLifecycle(db);
    const approvalSvc = approvalService(db);
    const pending = await agentSvcLifecycle.requestHire(companyId, {
      name: "Pending Coder",
      role: "engineer",
      title: "Software Engineer",
      icon: "code",
      capabilities: "Writes code",
      adapterType: "process",
      adapterConfig: { command: "echo safe" },
      runtimeConfig: { maxConcurrentRuns: 1 },
      budgetMonthlyCents: 1234,
      metadata: { source: "hire-form" },
      status: "pending_approval",
      spentMonthlyCents: 0,
      permissions: {},
      lastHeartbeatAt: null,
    });
    const approval = await approvalSvc.create(companyId, {
      type: "hire_agent",
      requestedByAgentId: null,
      requestedByUserId: "board-user",
      status: "pending",
      payload: {
        name: "Pending Coder",
        role: "engineer",
        title: "Software Engineer",
        icon: "code",
        reportsTo: null,
        capabilities: "Writes code",
        adapterType: "process",
        adapterConfig: { command: "echo safe" },
        runtimeConfig: { maxConcurrentRuns: 1 },
        budgetMonthlyCents: 1234,
        metadata: { source: "hire-form" },
        agentId: pending.id,
        appearance: pending.appearance,
      },
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: new Date(),
    });

    await expect(agentSvc.update(pending.id, {
      name: "Tampered Coder",
      adapterConfig: { command: "echo malicious" },
      runtimeConfig: { maxConcurrentRuns: 99 },
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "pending_approval_agent_config_frozen",
        agentId: pending.id,
        fields: ["name", "adapterConfig", "runtimeConfig"],
      },
    });
    await expect(agentSvc.updatePermissions(pending.id, {
      canCreateAgents: true,
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "pending_approval_agent_config_frozen",
        agentId: pending.id,
        fields: ["permissions"],
      },
    });

    await db
      .update(agents)
      .set({
        name: "Tampered Coder",
        adapterConfig: { command: "echo malicious" },
        runtimeConfig: { maxConcurrentRuns: 99 },
        metadata: { source: "tampered" },
      })
      .where(eq(agents.id, pending.id));

    await approvalSvc.approve(approval.id, "board-user", "Approved generic hire");

    await expect(agentSvc.getById(pending.id)).resolves.toMatchObject({
      status: "paused",
      lifecycleState: "preparing",
      appearance: pending.appearance,
      name: "Pending Coder",
      role: "engineer",
      title: "Software Engineer",
      icon: "code",
      capabilities: "Writes code",
      adapterType: "process",
      adapterConfig: { command: "echo safe" },
      runtimeConfig: { maxConcurrentRuns: 1 },
      budgetMonthlyCents: 1234,
      metadata: { source: "hire-form" },
    });
  });

  it("replays approved skills and instructions and removes standard grants for restricted hires", async () => {
    const companyId = await seedCompany();
    await seedApprover(companyId);
    const agentSvc = agentService(db);
    const lifecycle = createAgentLifecycle(db);
    const approvalSvc = approvalService(db);
    const pending = await lifecycle.requestHire(companyId, {
      name: "Restricted Reliability Analyst",
      role: "engineer",
      title: "Reliability Analyst",
      icon: "shield",
      capabilities: "Diagnostics",
      adapterType: "codex_local",
      adapterConfig: { search: false, paperclipSkillSync: { desiredSkills: [{ key: "paperclipai/paperclip/browser-use", versionId: "version-7" }] } },
      runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true, maxConcurrentRuns: 1 } },
      budgetMonthlyCents: 0,
      metadata: null,
      status: "pending_approval",
      spentMonthlyCents: 0,
      permissions: { canCreateAgents: false, canCreateSkills: false, canAssignTasks: false },
      lastHeartbeatAt: null,
    });
    expect(pending).toMatchObject({
      status: "pending_approval",
      lifecycleState: "pending_approval",
      permissions: { canCreateAgents: false, canCreateSkills: false, canAssignTasks: false },
      runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true, maxConcurrentRuns: 1 } },
    });
    await db.insert(principalPermissionGrants).values(
      NEW_STANDARD_AGENT_DEFAULT_GRANT_KEYS.map((permissionKey) => ({
        companyId,
        principalType: "agent" as const,
        principalId: pending.id,
        permissionKey,
        scope: permissionKey === "tasks:assign_scope" ? { subtreeRootAgentId: pending.id } : null,
      })),
    );
    const instructions = "Approved reliability instructions.";
    const approval = await approvalSvc.create(companyId, {
      type: "hire_agent",
      requestedByAgentId: null,
      requestedByUserId: "board-user",
      status: "pending",
      payload: {
        agentId: pending.id,
        name: pending.name,
        role: pending.role,
        title: pending.title,
        icon: pending.icon,
        adapterType: pending.adapterType,
        runtimeConfig: pending.runtimeConfig,
        permissions: { canCreateAgents: false, canCreateSkills: false, canAssignTasks: false },
        desiredSkills: ["paperclipai/paperclip/browser-use"],
        instructionsBundle: { entryFile: "AGENTS.md", files: { "AGENTS.md": instructions } },
      },
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: new Date(),
    });

    await approvalSvc.approve(approval.id, "board-user", "Approved restricted hire");

    const updated = await agentSvc.getById(pending.id);
    expect(updated).toMatchObject({
      status: "paused",
      adapterConfig: {
        paperclipSkillSync: { desiredSkills: [{ key: "paperclipai/paperclip/browser-use", versionId: "version-7" }] },
      },
      runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true, maxConcurrentRuns: 1 } },
      permissions: { canCreateAgents: false, canCreateSkills: false, canAssignTasks: false },
    });

    const [grantRows, file] = await Promise.all([
      db.select({ permissionKey: principalPermissionGrants.permissionKey })
        .from(principalPermissionGrants)
        .where(eq(principalPermissionGrants.principalId, pending.id)),
      (await import("../services/agent-instructions.js")).agentInstructionsService(db)
        .readFile(updated!, "AGENTS.md"),
    ]);
    expect(grantRows).toEqual([]);
    expect(file.content).toBe(instructions);
  });

  it("preserves the existing adapter configuration when approval omits adapterConfig", async () => {
    const companyId = await seedCompany();
    await seedApprover(companyId);
    const lifecycle = createAgentLifecycle(db);
    const approvalSvc = approvalService(db);
    const pending = await lifecycle.requestHire(companyId, {
      name: "Preserved Adapter Configuration",
      adapterType: "process",
      adapterConfig: { search: true, command: "echo safe" },
      runtimeConfig: {}, budgetMonthlyCents: 0, metadata: null, status: "pending_approval",
      spentMonthlyCents: 0, permissions: {}, lastHeartbeatAt: null,
    });
    const approval = await approvalSvc.create(companyId, {
      type: "hire_agent", requestedByAgentId: null, requestedByUserId: "board-user", status: "pending",
      payload: { agentId: pending.id, instructionsBundle: { entryFile: "AGENTS.md", files: { "AGENTS.md": "Keep settings" } } },
      decisionNote: null, decidedByUserId: null, decidedAt: null, updatedAt: new Date(),
    });

    await approvalSvc.approve(approval.id, "board-user", "Approved");

    const updated = await agentService(db).getById(pending.id);
    expect(updated?.adapterConfig).toMatchObject({ search: true, command: "echo safe" });
  });

  it("applies approved skill additions and removals while retaining approved versionIds", async () => {
    const companyId = await seedCompany();
    await seedApprover(companyId);
    const lifecycle = createAgentLifecycle(db);
    const approvalSvc = approvalService(db);
    const pending = await lifecycle.requestHire(companyId, {
      name: "Skill Reconciliation Hire",
      adapterType: "process",
      adapterConfig: {
        paperclipSkillSync: {
          desiredSkills: [
            { key: "paperclipai/paperclip/keep", versionId: "version-keep" },
            { key: "paperclipai/paperclip/remove", versionId: "version-remove" },
          ],
        },
      },
      runtimeConfig: {}, budgetMonthlyCents: 0, metadata: null, status: "pending_approval",
      spentMonthlyCents: 0, permissions: {}, lastHeartbeatAt: null,
    });
    const approval = await approvalSvc.create(companyId, {
      type: "hire_agent", requestedByAgentId: null, requestedByUserId: "board-user", status: "pending",
      payload: {
        agentId: pending.id,
        desiredSkills: [
          "paperclipai/paperclip/keep",
          { key: "paperclipai/paperclip/add", versionId: "version-add" },
        ],
        instructionsBundle: { entryFile: "AGENTS.md", files: { "AGENTS.md": "Reconcile skills" } },
      },
      decisionNote: null, decidedByUserId: null, decidedAt: null, updatedAt: new Date(),
    });

    await approvalSvc.approve(approval.id, "board-user", "Approved skill reconciliation");

    const updated = await agentService(db).getById(pending.id);
    expect(updated?.adapterConfig).toMatchObject({
      paperclipSkillSync: {
        desiredSkills: [
          { key: "paperclipai/paperclip/keep", versionId: "version-keep" },
          { key: "paperclipai/paperclip/add", versionId: "version-add" },
        ],
      },
    });
    const desiredSkills = (updated?.adapterConfig as {
      paperclipSkillSync?: { desiredSkills?: unknown[] };
    } | undefined)?.paperclipSkillSync?.desiredSkills;
    expect(desiredSkills).not.toEqual(expect.arrayContaining([
      { key: "paperclipai/paperclip/remove", versionId: "version-remove" },
    ]));
  });

  it("does not restore removed adapter settings when approval explicitly replaces adapterConfig", async () => {
    const companyId = await seedCompany();
    await seedApprover(companyId);
    const lifecycle = createAgentLifecycle(db);
    const approvalSvc = approvalService(db);
    const pending = await lifecycle.requestHire(companyId, {
      name: "Replaced Adapter Configuration",
      adapterType: "process",
      adapterConfig: { search: true, command: "echo safe" },
      runtimeConfig: {}, budgetMonthlyCents: 0, metadata: null, status: "pending_approval",
      spentMonthlyCents: 0, permissions: {}, lastHeartbeatAt: null,
    });
    const approval = await approvalSvc.create(companyId, {
      type: "hire_agent", requestedByAgentId: null, requestedByUserId: "board-user", status: "pending",
      payload: {
        agentId: pending.id,
        adapterConfig: {},
        instructionsBundle: { entryFile: "AGENTS.md", files: { "AGENTS.md": "Replace settings" } },
      },
      decisionNote: null, decidedByUserId: null, decidedAt: null, updatedAt: new Date(),
    });

    await approvalSvc.approve(approval.id, "board-user", "Approved replacement");

    const updated = await agentService(db).getById(pending.id);
    expect(updated?.adapterConfig).not.toHaveProperty("search");
    expect(updated?.adapterConfig).not.toHaveProperty("command");
  });

  it("approves revised entry instructions through the canonical revision service", async () => {
    const companyId = await seedCompany();
    await seedApprover(companyId);
    const lifecycle = createAgentLifecycle(db);
    const approvalSvc = approvalService(db);
    const pending = await lifecycle.requestHire(companyId, {
      name: "Revision Analyst", role: "engineer", adapterType: "process", adapterConfig: {},
      runtimeConfig: {}, budgetMonthlyCents: 0, metadata: null, status: "pending_approval",
      spentMonthlyCents: 0, permissions: {}, lastHeartbeatAt: null,
    });
    const bundle = await agentInstructionsService(db).materializeManagedBundle(pending, { "AGENTS.md": "Original" }, { replaceExisting: true });
    await db.update(agents).set({ adapterConfig: bundle.adapterConfig }).where(eq(agents.id, pending.id));
    const approval = await approvalSvc.create(companyId, {
      type: "hire_agent", requestedByAgentId: null, requestedByUserId: "board-user", status: "revision_requested",
      payload: { agentId: pending.id, instructionsBundle: { entryFile: "AGENTS.md", files: { "AGENTS.md": "Original" } } },
      decisionNote: "Please revise", decidedByUserId: "board-user", decidedAt: new Date(), updatedAt: new Date(),
    });
    await approvalSvc.resubmit(approval.id, { agentId: pending.id, instructionsBundle: { entryFile: "ROLE.md", files: { "ROLE.md": "Revised" } } });
    await approvalSvc.approve(approval.id, "board-user", "Approved revised instructions");
    const activated = await agentService(db).getById(pending.id);
    expect(activated).toMatchObject({ status: "paused", adapterConfig: { instructionsEntryFile: "ROLE.md" } });
    const current = await agentInstructionRevisionService(db).readCurrent({ companyId, agentId: pending.id }, { type: "board", userId: "board-user" });
    expect(current?.revision.entryFile).toBe("ROLE.md");
    expect(current?.content).toBe("Revised");
  });
});
