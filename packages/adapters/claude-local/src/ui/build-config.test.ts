import { describe, expect, it } from "vitest";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { buildClaudeLocalConfig } from "./build-config.js";

function makeValues(overrides: Partial<CreateConfigValues> = {}): CreateConfigValues {
  return {
    adapterType: "claude_local",
    cwd: "",
    instructionsFilePath: "",
    promptTemplate: "",
    model: "claude-opus-4-7",
    thinkingEffort: "",
    chrome: false,
    dangerouslySkipPermissions: true,
    claudeEngine: "auto",
    search: false,
    fastMode: false,
    dangerouslyBypassSandbox: false,
    command: "",
    args: "",
    extraArgs: "",
    envVars: "",
    envBindings: {},
    url: "",
    bootstrapPrompt: "",
    payloadTemplateJson: "",
    workspaceStrategyType: "project_primary",
    workspaceBaseRef: "",
    workspaceBranchTemplate: "",
    worktreeParentDir: "",
    runtimeServicesJson: "",
    maxTurnsPerRun: 1000,
    heartbeatEnabled: false,
    intervalSec: 300,
    ...overrides,
  };
}

describe("buildClaudeLocalConfig", () => {
  it.each([undefined, "legacy"] as const)("retains the default turn cap when Auto has resolved to %s", resolvedRunner => {
    expect(buildClaudeLocalConfig(makeValues({ runner: "auto", resolvedRunner })).maxTurnsPerRun).toBe(1000);
  });
  it.each(["auto", "paperclip"] as const)("omits the Legacy default only for native %s", runner => {
    const config = buildClaudeLocalConfig(makeValues({ runner, resolvedRunner: "paperclip" }));
    expect(config).not.toHaveProperty("maxTurnsPerRun");
    expect(buildClaudeLocalConfig(makeValues({ runner, resolvedRunner: "paperclip", maxTurnsPerRun: 3 })).maxTurnsPerRun).toBe(3);
  });
  it("retains an explicit Legacy cap over a stale native form resolution", () => {
    expect(buildClaudeLocalConfig(makeValues({ runner: "legacy", resolvedRunner: "paperclip" })).maxTurnsPerRun).toBe(1000);
  });
  it.each(["approve-all", "approve-reads", "deny-all"])("carries the selected native %s permission to creation", acpxPermissionMode => {
    expect(buildClaudeLocalConfig(makeValues({ resolvedRunner: "paperclip", adapterSchemaValues: { acpxPermissionMode } })).acpxPermissionMode).toBe(acpxPermissionMode);
  });
  it.each([
    ["paperclip", undefined],
    ["auto", "paperclip"],
  ] as const)("omits the legacy permission flag for native runs (%s/%s)", (runner, resolvedRunner) => {
    for (const dangerouslySkipPermissions of [true, false]) {
      const config = buildClaudeLocalConfig(makeValues({ runner, resolvedRunner, dangerouslySkipPermissions }));
      expect(config).not.toHaveProperty("dangerouslySkipPermissions");
    }
  });
  it.each([undefined, "legacy"] as const)("persists the permission flag for legacy runs resolved to %s", resolvedRunner => {
    expect(buildClaudeLocalConfig(makeValues({ runner: "auto", resolvedRunner, dangerouslySkipPermissions: false })))
      .toMatchObject({ dangerouslySkipPermissions: false });
    expect(buildClaudeLocalConfig(makeValues({ runner: "legacy", resolvedRunner, dangerouslySkipPermissions: true })))
      .toMatchObject({ dangerouslySkipPermissions: true });
  });
  it("omits engine for the auto default so runtime fallback remains available", () => {
    const config = buildClaudeLocalConfig(makeValues({ claudeEngine: "auto" }));

    expect(config).not.toHaveProperty("engine");
  });

  it("persists explicit engine pins", () => {
    expect(buildClaudeLocalConfig(makeValues({ claudeEngine: "cli" }))).toMatchObject({ engine: "cli" });
    expect(buildClaudeLocalConfig(makeValues({ claudeEngine: "acp" }))).toMatchObject({ engine: "acp" });
  });

  it("keeps user-scoped env bindings so the server resolves them at test time", () => {
    const config = buildClaudeLocalConfig(
      makeValues({
        envBindings: {
          GH_TOKEN: { type: "user_secret_ref", key: "github_token", version: "latest", required: true },
        },
      }),
    );

    expect(config.env).toEqual({
      GH_TOKEN: { type: "user_secret_ref", key: "github_token", version: "latest", required: true },
    });
  });

  it("keeps company secret and plain env bindings", () => {
    const config = buildClaudeLocalConfig(
      makeValues({
        envBindings: {
          API_KEY: { type: "secret_ref", secretId: "11111111-1111-1111-1111-111111111111", version: "latest" },
          FLAG: { type: "plain", value: "on" },
        },
      }),
    );

    expect(config.env).toEqual({
      API_KEY: { type: "secret_ref", secretId: "11111111-1111-1111-1111-111111111111", version: "latest" },
      FLAG: { type: "plain", value: "on" },
    });
  });
});
