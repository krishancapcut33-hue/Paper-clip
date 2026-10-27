import { describe, expect, it } from "vitest";
import { configPatchFromApprovalPayload } from "./agent-records.js";

describe("configPatchFromApprovalPayload", () => {
  it("projects approved desired skills into the persisted adapter configuration", () => {
    const patch = configPatchFromApprovalPayload({
      adapterConfig: { search: false },
      desiredSkills: ["paperclipai/paperclip/paperclip"],
      permissions: { canCreateAgents: false, canCreateSkills: false, canAssignTasks: false },
      runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true, maxConcurrentRuns: 1 } },
    });

    expect(patch.adapterConfig).toEqual({
      search: false,
      paperclipSkillSync: { desiredSkills: ["paperclipai/paperclip/paperclip"] },
    });
    expect(patch.permissions).toEqual({
      canCreateAgents: false,
      canCreateSkills: false,
      canAssignTasks: false,
    });
    expect(patch.runtimeConfig).toEqual({
      heartbeat: { enabled: false, wakeOnDemand: true, maxConcurrentRuns: 1 },
    });
  });

  it("preserves pinned skills and unrelated adapter settings for partial approvals", () => {
    const patch = configPatchFromApprovalPayload({ desiredSkills: ["paperclipai/paperclip/pinned"] }, {
      model: "reviewed-model",
      paperclipSkillSync: { desiredSkills: [{ key: "paperclipai/paperclip/pinned", versionId: "version-7" }] },
    });
    expect(patch.adapterConfig).toEqual({
      model: "reviewed-model",
      paperclipSkillSync: { desiredSkills: [{ key: "paperclipai/paperclip/pinned", versionId: "version-7" }] },
    });
  });
});
