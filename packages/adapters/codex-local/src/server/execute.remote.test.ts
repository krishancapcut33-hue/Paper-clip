import fs, { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  runChildProcess,
  ensureCommandResolvable,
  resolveCommandForLogs,
  prepareWorkspaceForSshExecution,
  restoreWorkspaceFromSshExecution,
  runSshCommand,
  syncDirectoryToSsh,
  startAdapterExecutionTargetPaperclipBridge,
  beforeStageCodexHome,
} = vi.hoisted(() => ({
  runChildProcess: vi.fn<typeof import("@paperclipai/adapter-utils/server-utils").runChildProcess>(async () => ({
    exitCode: 1,
    signal: null,
    timedOut: false,
    stdout: "",
    stderr: "remote failure",
    pid: 123,
    startedAt: new Date().toISOString(),
  })),
  ensureCommandResolvable: vi.fn(async () => undefined),
  resolveCommandForLogs: vi.fn(async () => "/usr/bin/codex"),
  prepareWorkspaceForSshExecution: vi.fn(async () => ({ gitBacked: false })),
  restoreWorkspaceFromSshExecution: vi.fn(async () => undefined),
  runSshCommand: vi.fn(async () => ({ stdout: Buffer.from("{}").toString("base64"), stderr: "" })),
  syncDirectoryToSsh: vi.fn(async (_input: { localDir: string }): Promise<void> => undefined),
  beforeStageCodexHome: vi.fn(async (_options: { runId?: string }): Promise<void> => undefined),
  startAdapterExecutionTargetPaperclipBridge: vi.fn(async () => ({
    env: {
      PAPERCLIP_API_URL: "http://127.0.0.1:4310",
      PAPERCLIP_API_KEY: "bridge-token",
      PAPERCLIP_API_BRIDGE_MODE: "queue_v1",
    },
    stop: async () => {},
  })),
}));

vi.mock("@paperclipai/adapter-utils/server-utils", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/server-utils")>(
    "@paperclipai/adapter-utils/server-utils",
  );
  return {
    ...actual,
    ensureCommandResolvable,
    resolveCommandForLogs,
    runChildProcess,
  };
});

vi.mock("@paperclipai/adapter-utils/ssh", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/ssh")>(
    "@paperclipai/adapter-utils/ssh",
  );
  return {
    ...actual,
    prepareWorkspaceForSshExecution,
    restoreWorkspaceFromSshExecution,
    runSshCommand,
    syncDirectoryToSsh,
  };
});

vi.mock("@paperclipai/adapter-utils/execution-target", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/execution-target")>(
    "@paperclipai/adapter-utils/execution-target",
  );
  return {
    ...actual,
    startAdapterExecutionTargetPaperclipBridge,
  };
});

vi.mock("./codex-home.js", async () => {
  const actual = await vi.importActual<typeof import("./codex-home.js")>("./codex-home.js");
  return {
    ...actual,
    stageCodexHomeForSync: async (...args: Parameters<typeof actual.stageCodexHomeForSync>) => {
      await beforeStageCodexHome(args[1] ?? {});
      return actual.stageCodexHomeForSync(...args);
    },
  };
});

import { createPromptContextFixture } from "@paperclipai/adapter-utils/test-fixtures/prompt-context";
import { execute } from "./execute.js";
import { prepareCodexRuntimeConfig } from "./runtime-config.js";

describe("codex remote execution", () => {
  const cleanupDirs: string[] = [];

  afterEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    while (cleanupDirs.length > 0) {
      const dir = cleanupDirs.pop();
      if (!dir) continue;
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("prepares the workspace, syncs CODEX_HOME, and restores workspace changes for remote SSH execution", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-remote-"));
    cleanupDirs.push(rootDir);
    const workspaceDir = path.join(rootDir, "workspace");
    const codexHomeDir = path.join(rootDir, "codex-home");
    const managedRemoteWorkspace = "/remote/workspace/.paperclip-runtime/runs/run-1/workspace";
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(codexHomeDir, { recursive: true });
    await writeFile(path.join(rootDir, "instructions.md"), "Use the remote workspace.\n", "utf8");
    await writeFile(path.join(codexHomeDir, "auth.json"), "{}", "utf8");
    const alternateWorkspaceDir = path.join(rootDir, "alternate-workspace");
    await mkdir(alternateWorkspaceDir, { recursive: true });

    await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "CodexCoder",
        adapterType: "codex_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        engine: "cli",
        command: "codex",
        env: {
          CODEX_HOME: codexHomeDir,
        },
      },
      context: {
        paperclipWorkspace: {
          cwd: workspaceDir,
          source: "project_primary",
          strategy: "git_worktree",
          workspaceId: "workspace-1",
          repoUrl: "https://github.com/paperclipai/paperclip.git",
          repoRef: "main",
          branchName: "feature/remote-codex",
          worktreePath: workspaceDir,
        },
        paperclipWorkspaces: [
          {
            workspaceId: "workspace-1",
            cwd: workspaceDir,
            repoUrl: "https://github.com/paperclipai/paperclip.git",
            repoRef: "main",
          },
          {
            workspaceId: "workspace-2",
            cwd: alternateWorkspaceDir,
            repoUrl: "https://github.com/paperclipai/paperclip.git",
            repoRef: "feature/other",
          },
        ],
      },
      executionTransport: {
        remoteExecution: {
          host: "127.0.0.1",
          port: 2222,
          username: "fixture",
          remoteWorkspacePath: "/remote/workspace",
          remoteCwd: "/remote/workspace",
          privateKey: "PRIVATE KEY",
          knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
          strictHostKeyChecking: true,
        },
      },
      onLog: async () => {},
    });

    expect(prepareWorkspaceForSshExecution).toHaveBeenCalledTimes(1);
    expect(prepareWorkspaceForSshExecution).toHaveBeenCalledWith(expect.objectContaining({
      localDir: workspaceDir,
      remoteDir: managedRemoteWorkspace,
    }));
    expect(syncDirectoryToSsh).toHaveBeenCalledTimes(1);
    // The home asset now syncs a curated *staged* allowlist dir, not the raw
    // managed CODEX_HOME, and carries no `exclude` denylist.
    const homeSyncArgs = (syncDirectoryToSsh.mock.calls[0] as unknown[])?.[0] as {
      localDir: string;
      remoteDir: string;
      followSymlinks?: boolean;
      exclude?: string[];
    };
    expect(homeSyncArgs.localDir).not.toBe(codexHomeDir);
    expect(homeSyncArgs.localDir).toContain("paperclip-codex-home-sync");
    expect(homeSyncArgs.remoteDir).toBe(`${managedRemoteWorkspace}/.paperclip-runtime/codex/home`);
    expect(homeSyncArgs.followSymlinks).toBe(true);
    expect(homeSyncArgs.exclude).toBeUndefined();

    expect(runChildProcess).toHaveBeenCalledTimes(1);
    const call = runChildProcess.mock.calls[0] as unknown as
      | [string, string, string[], { env: Record<string, string>; remoteExecution?: { remoteCwd: string } | null }]
      | undefined;
    expect(call?.[2]).not.toContain("--skip-git-repo-check");
    expect(call?.[3].env.CODEX_HOME).toBe(`${managedRemoteWorkspace}/.paperclip-runtime/codex/home`);
    expect(call?.[3].env.PAPERCLIP_WORKSPACE_CWD).toBe(managedRemoteWorkspace);
    expect(call?.[3].env.PAPERCLIP_WORKSPACE_WORKTREE_PATH).toBeUndefined();
    expect(JSON.parse(call?.[3].env.PAPERCLIP_WORKSPACES_JSON ?? "[]")).toEqual([
      {
        workspaceId: "workspace-1",
        cwd: managedRemoteWorkspace,
        repoUrl: "https://github.com/paperclipai/paperclip.git",
        repoRef: "main",
      },
      {
        workspaceId: "workspace-2",
        repoUrl: "https://github.com/paperclipai/paperclip.git",
        repoRef: "feature/other",
      },
    ]);
    expect(call?.[3].env.PAPERCLIP_API_URL).toBe("http://127.0.0.1:4310");
    expect(call?.[3].env.PAPERCLIP_API_BRIDGE_MODE).toBe("queue_v1");
    expect(call?.[3].remoteExecution?.remoteCwd).toBe(managedRemoteWorkspace);
    expect(startAdapterExecutionTargetPaperclipBridge).toHaveBeenCalledTimes(1);
    expect(restoreWorkspaceFromSshExecution).toHaveBeenCalledTimes(1);
    expect(restoreWorkspaceFromSshExecution).toHaveBeenCalledWith(expect.objectContaining({
      localDir: workspaceDir,
      remoteDir: managedRemoteWorkspace,
    }));
  });

  it.each([
    ["default", true],
    ["isolated-api-key", true],
    ["isolated-subscription", false],
    ["external", false],
    ["account-cache", false],
    ["other-agent", false],
    ["other-company", false],
    ["user-managed", false],
  ] as const)("merges provider routing only into eligible homes: %s", async (kind, shouldMerge) => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-routing-"));
    cleanupDirs.push(rootDir);
    const paperclipHome = path.join(rootDir, "paperclip");
    const companyRoot = path.join(paperclipHome, "instances", "default", "companies", "company-1");
    const workspaceDir = path.join(rootDir, "workspace");
    const homes = {
      default: path.join(companyRoot, "codex-home"),
      "isolated-api-key": path.join(companyRoot, "agents", "agent-1", "codex-home"),
      "isolated-subscription": path.join(companyRoot, "agents", "agent-1", "codex-home"),
      external: path.join(rootDir, "external-home"),
      "account-cache": path.join(companyRoot, "codex-auth-cache", "fixture-account"),
      "other-agent": path.join(companyRoot, "agents", "agent-2", "codex-home"),
      "other-company": path.join(companyRoot, "..", "company-2", "agents", "agent-1", "codex-home"),
      "user-managed": path.join(companyRoot, "custom-home"),
    };
    const home = homes[kind];
    const originalConfig = 'model = "original-model"\n';
    const originalAuth = JSON.stringify({
      tokens: { account_id: "fixture-account", access_token: "fixture-access", refresh_token: "fixture-refresh" },
    });
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(home, { recursive: true });
    await writeFile(path.join(home, "config.toml"), originalConfig);
    await writeFile(path.join(home, "auth.json"), originalAuth, { mode: 0o600 });
    vi.stubEnv("PAPERCLIP_HOME", paperclipHome);
    vi.stubEnv("PAPERCLIP_INSTANCE_ID", "default");
    vi.stubEnv("CODEX_HOME", path.join(rootDir, "empty-shared-home"));
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("PAPERCLIP_CODEX_PROVIDERS", JSON.stringify({
      providers: { gateway: {
        name: "Fixture gateway", base_url: "https://gateway.example/v1",
        env_key: "OPENAI_API_KEY", wire_api: "responses",
      } },
      model_provider: "gateway",
    }));
    let stagedConfig = "";
    let stagedAuth = "";
    syncDirectoryToSsh.mockImplementationOnce(async ({ localDir }) => {
      stagedConfig = await readFile(path.join(localDir, "config.toml"), "utf8");
      stagedAuth = await readFile(path.join(localDir, "auth.json"), "utf8");
    });

    await execute({
      runId: "run-provider-routing",
      agent: {
        id: "agent-1", companyId: "company-1", name: "CodexCoder",
        adapterType: "codex_local", adapterConfig: {},
      },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: {
        engine: "cli", command: "codex", model: "gateway/custom-model",
        env: {
          ...(kind === "default" ? {} : { CODEX_HOME: home }),
          OPENAI_API_KEY: kind === "isolated-subscription" ? "" : "fixture-api-key",
        },
      },
      context: { paperclipWorkspace: { cwd: workspaceDir, source: "project_primary" } },
      executionTransport: { remoteExecution: {
        host: "127.0.0.1", port: 2222, username: "fixture",
        remoteWorkspacePath: "/remote/workspace", remoteCwd: "/remote/workspace",
        privateKey: "PRIVATE KEY", knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
        strictHostKeyChecking: true,
      } },
      onLog: async () => {},
    });

    expect(stagedConfig.includes('[model_providers.gateway]')).toBe(shouldMerge);
    expect(stagedConfig).toContain('model = "original-model"');
    expect(stagedConfig).not.toContain("fixture-api-key");
    if (shouldMerge) {
      expect(stagedConfig).toContain('model_provider = "gateway"');
      expect(stagedConfig).toContain('base_url = "https://gateway.example/v1"');
      expect(stagedConfig).toContain('env_key = "OPENAI_API_KEY"');
      expect(stagedConfig).toContain('wire_api = "responses"');
    }
    const call = runChildProcess.mock.calls[0] as unknown as [string, string, string[]];
    expect(call[2]).toContain("gateway/custom-model");
    expect(await readFile(path.join(home, "config.toml"), "utf8")).toBe(originalConfig);
    expect(await readFile(path.join(home, "auth.json"), "utf8")).toBe(stagedAuth);
    if (kind === "isolated-api-key") {
      expect(JSON.parse(stagedAuth)).toEqual({ OPENAI_API_KEY: "fixture-api-key" });
    }
    if (kind === "account-cache" || kind === "isolated-subscription") {
      expect(stagedAuth).toBe(originalAuth);
    }
  });

  it.each(["first-exits-before-staging", "both-running"] as const)("isolates overlapping remote routing snapshots: %s", async (order) => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-overlap-"));
    cleanupDirs.push(rootDir);
    const paperclipHome = path.join(rootDir, "paperclip");
    const workspaceDir = path.join(rootDir, "workspace");
    const home = path.join(paperclipHome, "instances", "default", "companies", "company-1", "agents", "agent-1", "codex-home");
    const originalConfig = 'approval_policy = "never"\n';
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(home, { recursive: true });
    await writeFile(path.join(home, "config.toml"), originalConfig);
    vi.stubEnv("PAPERCLIP_HOME", paperclipHome);
    vi.stubEnv("PAPERCLIP_INSTANCE_ID", "default");
    vi.stubEnv("CODEX_HOME", path.join(rootDir, "empty-shared-home"));
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("PAPERCLIP_CODEX_PROVIDERS", "");
    const barrier = () => {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => { release = resolve; });
      return { promise, release };
    };
    const firstLaunched = barrier();
    const finishFirst = barrier();
    const secondPrepared = barrier();
    const stageSecond = barrier();
    const secondLaunched = barrier();
    const finishSecond = barrier();
    const stagedHomes: string[] = [];
    const stagedConfigs: string[] = [];
    const stage = async ({ localDir }: { localDir: string }) => {
      stagedHomes.push(localDir);
      stagedConfigs.push(await readFile(path.join(localDir, "config.toml"), "utf8"));
    };
    syncDirectoryToSsh.mockImplementationOnce(stage).mockImplementationOnce(stage);
    beforeStageCodexHome.mockImplementationOnce(async () => {}).mockImplementationOnce(async () => {
      secondPrepared.release();
      await stageSecond.promise;
    });
    const finished = {
      exitCode: 0, signal: null, timedOut: false, stdout: "", stderr: "",
      pid: 123, startedAt: new Date().toISOString(),
    };
    runChildProcess.mockImplementationOnce(async () => {
      firstLaunched.release();
      await finishFirst.promise;
      return finished;
    }).mockImplementationOnce(async () => {
      secondLaunched.release();
      await finishSecond.promise;
      return finished;
    });
    const run = (suffix: string) => execute({
      runId: `run-overlap-${suffix}`,
      agent: {
        id: "agent-1", companyId: "company-1", name: "CodexCoder",
        adapterType: "codex_local", adapterConfig: {},
      },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: {
        engine: "cli", command: "codex", model: "gateway/custom-model",
        env: {
          CODEX_HOME: home, OPENAI_API_KEY: "fixture-api-key",
          PAPERCLIP_CODEX_PROVIDERS: JSON.stringify({
            providers: { gateway: {
              base_url: `https://${suffix}.example/v1`, env_key: "OPENAI_API_KEY", wire_api: "responses",
            } },
            model_provider: "gateway",
          }),
        },
      },
      context: { paperclipWorkspace: { cwd: workspaceDir, source: "project_primary" } },
      executionTransport: { remoteExecution: {
        host: "127.0.0.1", port: 2222, username: "fixture",
        remoteWorkspacePath: "/remote/workspace", remoteCwd: "/remote/workspace",
        privateKey: "PRIVATE KEY", knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
        strictHostKeyChecking: true,
      } },
      onLog: async () => {},
    });
    const first = run("first");
    await firstLaunched.promise;
    const second = run("second");
    try {
      await secondPrepared.promise;
      if (order === "first-exits-before-staging") {
        finishFirst.release();
        await first;
        stageSecond.release();
        await secondLaunched.promise;
      } else {
        stageSecond.release();
        await secondLaunched.promise;
        expect(runChildProcess).toHaveBeenCalledTimes(2);
        expect(await readFile(path.join(stagedHomes[0], "config.toml"), "utf8")).toBe(stagedConfigs[0]);
      }
      finishSecond.release();
      await second;
      if (order === "both-running") {
        expect(await readFile(path.join(stagedHomes[0], "config.toml"), "utf8")).toBe(stagedConfigs[0]);
        finishFirst.release();
        await first;
      }
      expect(stagedConfigs[0]).toContain('base_url = "https://first.example/v1"');
      expect(stagedConfigs[1]).toContain('base_url = "https://second.example/v1"');
      expect(await readFile(path.join(home, "config.toml"), "utf8")).toBe(originalConfig);
      expect(JSON.parse(await readFile(path.join(home, "auth.json"), "utf8"))).toEqual({ OPENAI_API_KEY: "fixture-api-key" });
      for (const stagedHome of stagedHomes) {
        await expect(readdir(stagedHome)).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      finishFirst.release();
      stageSecond.release();
      finishSecond.release();
      await Promise.allSettled([first, second]);
    }
  });

  it.each(["seed", "staging", "cleanup"] as const)("releases the isolated home after %s failure and recovers legacy routing", async (failure) => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-lease-failure-"));
    cleanupDirs.push(rootDir);
    const paperclipHome = path.join(rootDir, "paperclip");
    const workspaceDir = path.join(rootDir, "workspace");
    const home = path.join(paperclipHome, "instances", "default", "companies", "company-1", "agents", "agent-1", "codex-home");
    const originalConfig = 'approval_policy = "never"\n';
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(home, { recursive: true });
    await writeFile(path.join(home, "config.toml"), originalConfig);
    vi.stubEnv("PAPERCLIP_HOME", paperclipHome);
    vi.stubEnv("PAPERCLIP_INSTANCE_ID", "default");
    vi.stubEnv("CODEX_HOME", path.join(rootDir, "empty-shared-home"));
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("PAPERCLIP_CODEX_PROVIDERS", "");
    const providers = JSON.stringify({
      providers: { gateway: { base_url: "https://gateway.example/v1", env_key: "OPENAI_API_KEY", wire_api: "responses" } },
      model_provider: "gateway",
    });
    await prepareCodexRuntimeConfig({ env: { PAPERCLIP_CODEX_PROVIDERS: providers }, codexHome: home });
    let failOnce = true;
    const realRemove = fs.rm;
    const remove = failure === "cleanup" ? vi.spyOn(fs, "rm").mockImplementation(async (...args) => {
      if (failOnce && String(args[0]).endsWith("config.toml.paperclip-backup")) {
        failOnce = false;
        throw new Error("fixture failure");
      }
      return realRemove(...args);
    }) : null;
    if (failure === "staging") beforeStageCodexHome.mockRejectedValueOnce(new Error("fixture failure"));
    const run = (suffix: string) => execute({
      runId: `run-failure-${suffix}`,
      agent: {
        id: "agent-1", companyId: "company-1", name: "CodexCoder",
        adapterType: "codex_local", adapterConfig: {},
      },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: {
        engine: "cli", command: "codex", model: "gateway/custom-model",
        env: { CODEX_HOME: home, OPENAI_API_KEY: "fixture-key", PAPERCLIP_CODEX_PROVIDERS: providers },
      },
      context: { paperclipWorkspace: { cwd: workspaceDir, source: "project_primary" } },
      executionTransport: { remoteExecution: {
        host: "127.0.0.1", port: 2222, username: "fixture",
        remoteWorkspacePath: "/remote/workspace", remoteCwd: "/remote/workspace",
        privateKey: "PRIVATE KEY", knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
        strictHostKeyChecking: true,
      } },
      onLog: async () => {
        if (failure === "seed" && failOnce) {
          failOnce = false;
          throw new Error("fixture failure");
        }
      },
    });
    try {
      await expect(run("failed")).rejects.toThrow("fixture failure");
      expect(runChildProcess).not.toHaveBeenCalled();
      await run("retry");
      expect(runChildProcess).toHaveBeenCalledTimes(1);
      expect(await readFile(path.join(home, "config.toml"), "utf8")).toBe(originalConfig);
      await expect(readFile(path.join(home, "config.toml.paperclip-backup"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      remove?.mockRestore();
    }
  });

  it.each([["success", true], ["success", false], ["process-error", true], ["signal", true]] as const)(
    "fails local contention before mutation and preserves resume state: %s, providers=%s",
    async (outcome, withProviders) => {
      const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-local-overlap-"));
      cleanupDirs.push(rootDir);
      const paperclipHome = path.join(rootDir, "paperclip");
      const workspaceDir = path.join(rootDir, "workspace");
      const home = path.join(paperclipHome, "instances", "default", "companies", "company-1", "agents", "agent-1", "codex-home");
      const originalConfig = 'model = "original-model"\n[model_providers.gateway]\nauth = { command = ["stale-command"] }\nhttp_headers = { Authorization = "stale-header" }\n';
      await mkdir(workspaceDir, { recursive: true });
      await mkdir(path.join(home, "sessions"), { recursive: true });
      await writeFile(path.join(home, "config.toml"), originalConfig);
      await writeFile(path.join(home, "sessions", "fixture.jsonl"), "saved session\n");
      vi.stubEnv("PAPERCLIP_HOME", paperclipHome);
      vi.stubEnv("PAPERCLIP_INSTANCE_ID", "default");
      vi.stubEnv("CODEX_HOME", path.join(rootDir, "empty-shared-home"));
      vi.stubEnv("OPENAI_API_KEY", "");
      vi.stubEnv("PAPERCLIP_CODEX_PROVIDERS", "");
      let announceFirst!: () => void;
      let finishFirst!: () => void;
      const firstLaunched = new Promise<void>((resolve) => { announceFirst = resolve; });
      const firstCanFinish = new Promise<void>((resolve) => { finishFirst = resolve; });
      const launches: Array<{ args: string[]; home: string; config: string; auth: unknown }> = [];
      const capture = async (args: string[], env: Record<string, string>) => {
        const launchedHome = env.CODEX_HOME;
        launches.push({
          args, home: launchedHome,
          config: await readFile(path.join(launchedHome, "config.toml"), "utf8"),
          auth: JSON.parse(await readFile(path.join(launchedHome, "auth.json"), "utf8")),
        });
      };
      const finished = {
        exitCode: 0, signal: null, timedOut: false, stdout: "", stderr: "",
        pid: 123, startedAt: new Date().toISOString(),
      };
      runChildProcess.mockImplementationOnce(async (_id, _command, args, options) => {
        await capture(args, options.env);
        announceFirst();
        await firstCanFinish;
        if (outcome === "process-error") throw new Error("fixture process failure");
        return outcome === "signal" ? { ...finished, exitCode: null, signal: "SIGTERM" } : finished;
      }).mockImplementationOnce(async (_id, _command, args, options) => {
        await capture(args, options.env);
        return finished;
      });
      const run = (suffix: string) => execute({
        runId: `run-local-${suffix}`,
        agent: {
          id: "agent-1", companyId: "company-1", name: "CodexCoder",
          adapterType: "codex_local", adapterConfig: {},
        },
        runtime: {
          sessionId: "fixture-session", sessionParams: { sessionId: "fixture-session", cwd: workspaceDir },
          sessionDisplayId: "fixture-session", taskKey: null,
        },
        config: {
          engine: "cli", command: "codex", model: "gateway/custom-model",
          env: {
            CODEX_HOME: home, OPENAI_API_KEY: `fixture-key-${suffix}`,
            PAPERCLIP_CODEX_PROVIDERS: withProviders ? JSON.stringify({
              providers: { gateway: {
                base_url: `https://${suffix}.example/v1`, env_key: "OPENAI_API_KEY", wire_api: "responses",
              } },
              model_provider: "gateway",
            }) : "",
          },
        },
        context: { paperclipWorkspace: { cwd: workspaceDir, source: "project_primary" } },
        onLog: async () => {},
      });
      const first = run("first").then(() => null, (error: Error) => error);
      await firstLaunched;
      try {
        const activeConfig = await readFile(path.join(home, "config.toml"), "utf8");
        const activeFiles = await readdir(home);
        expect(await run("second")).toMatchObject({
          errorCode: "codex_home_busy",
          executionRecovery: { kind: "bootstrap", providerWorkStarted: false },
        });
        expect(runChildProcess).toHaveBeenCalledTimes(1);
        expect(await readFile(path.join(home, "config.toml"), "utf8")).toBe(activeConfig);
        expect(await readdir(home)).toEqual(activeFiles);
        expect(JSON.parse(await readFile(path.join(home, "auth.json"), "utf8"))).toEqual({ OPENAI_API_KEY: "fixture-key-first" });
        finishFirst();
        expect((await first)?.message ?? null).toBe(outcome === "process-error" ? "fixture process failure" : null);
        await run("after");
        expect(launches).toHaveLength(2);
        if (withProviders) {
          expect(launches[0].config).toContain('base_url = "https://first.example/v1"');
          expect(launches[1].config).toContain('base_url = "https://after.example/v1"');
        }
        expect(launches[1].auth).toEqual({ OPENAI_API_KEY: "fixture-key-after" });
        for (const launch of launches) {
          expect(launch.home).toBe(await realpath(home));
          if (withProviders) expect(launch.config).not.toMatch(/stale-command|stale-header|fixture-key/);
          else expect(launch.config).toBe(originalConfig);
          expect(launch.args).toEqual(expect.arrayContaining(["gateway/custom-model", "resume", "fixture-session"]));
          expect(launch.args.join(" ")).not.toContain("fixture-key");
        }
        expect(await readFile(path.join(home, "config.toml"), "utf8")).toBe(originalConfig);
        expect(await readFile(path.join(home, "sessions", "fixture.jsonl"), "utf8")).toBe("saved session\n");
        await expect(readFile(path.join(home, "config.toml.paperclip-backup"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      } finally {
        finishFirst();
        await first;
      }
    },
  );

  it("stages only the allowlist into the home asset: keeps config.toml/skills/auth, drops session+sqlite state, no exclude", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-allowlist-"));
    cleanupDirs.push(rootDir);
    const workspaceDir = path.join(rootDir, "workspace");
    const codexHomeDir = path.join(rootDir, "codex-home");
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(codexHomeDir, { recursive: true });

    // Seed the managed home with the files Codex needs (config.toml carries a
    // provider-routing block; skills injected) plus large runtime decoys the
    // old 4-name denylist missed.
    await writeFile(path.join(codexHomeDir, "auth.json"), '{"tokens":{"account_id":"a","refresh_token":"r"}}', "utf8");
    await writeFile(
      path.join(codexHomeDir, "config.toml"),
      'model_provider = "bifrost"\n\n[model_providers.bifrost]\nname = "bifrost"\n',
      "utf8",
    );
    await writeFile(path.join(codexHomeDir, "instructions.md"), "hi\n", "utf8");
    await mkdir(path.join(codexHomeDir, "skills", "demo"), { recursive: true });
    await writeFile(path.join(codexHomeDir, "skills", "demo", "SKILL.md"), "# demo\n", "utf8");
    // Decoys:
    await writeFile(path.join(codexHomeDir, "logs_2.sqlite"), "x", "utf8");
    await writeFile(path.join(codexHomeDir, "state_5.sqlite"), "x", "utf8");
    await mkdir(path.join(codexHomeDir, "sessions"), { recursive: true });
    await writeFile(path.join(codexHomeDir, "sessions", "rollout.jsonl"), "x", "utf8");
    await mkdir(path.join(codexHomeDir, "tmp"), { recursive: true });
    await symlink("/usr/bin/env", path.join(codexHomeDir, "tmp", "arg0"));

    // Snapshot the staged dir contents at sync time — execute() removes the
    // staged temp dir on teardown, so we cannot read it after execute returns.
    let stagedSnapshot:
      | { localDir: string; entries: string[]; skillEntries: string[]; configToml: string; authJson: string }
      | null = null;
    (syncDirectoryToSsh as unknown as {
      mockImplementationOnce: (fn: (args: { localDir: string }) => Promise<void>) => void;
    }).mockImplementationOnce(async (args: { localDir: string }) => {
      const entries = (await readdir(args.localDir)).sort();
      const skillEntries = entries.includes("skills")
        ? (await readdir(path.join(args.localDir, "skills"))).sort()
        : [];
      const configToml = entries.includes("config.toml")
        ? await readFile(path.join(args.localDir, "config.toml"), "utf8")
        : "";
      const authJson = entries.includes("auth.json")
        ? await readFile(path.join(args.localDir, "auth.json"), "utf8")
        : "";
      stagedSnapshot = { localDir: args.localDir, entries, skillEntries, configToml, authJson };
    });

    await execute({
      runId: "run-allowlist",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "CodexCoder",
        adapterType: "codex_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        engine: "cli",
        command: "codex",
        env: {
          CODEX_HOME: codexHomeDir,
        },
      },
      context: {
        paperclipWorkspace: {
          cwd: workspaceDir,
          source: "project_primary",
        },
      },
      executionTransport: {
        remoteExecution: {
          host: "127.0.0.1",
          port: 2222,
          username: "fixture",
          remoteWorkspacePath: "/remote/workspace",
          remoteCwd: "/remote/workspace",
          privateKey: "PRIVATE KEY",
          knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
          strictHostKeyChecking: true,
        },
      },
      onLog: async () => {},
    });

    expect(stagedSnapshot).not.toBeNull();
    const snap = stagedSnapshot as unknown as {
      localDir: string;
      entries: string[];
      skillEntries: string[];
      configToml: string;
      authJson: string;
    };
    // Allowlist present; decoys gone.
    expect(snap.entries).toEqual(
      ["auth.json", "config.json", "config.toml", "instructions.md", "skills"]
        .filter((e) => e !== "config.json") // no config.json was seeded
        .sort(),
    );
    for (const decoy of ["logs_2.sqlite", "state_5.sqlite", "sessions", "tmp", "plugins"]) {
      expect(snap.entries).not.toContain(decoy);
    }
    // Phase-3 behavioral invariants: provider routing + skills + auth survive staging.
    expect(snap.configToml).toContain("[model_providers.bifrost]");
    expect(snap.configToml).toContain("model_provider");
    expect(snap.skillEntries).toContain("demo");
    expect(snap.authJson).toContain("refresh_token");

    // The staged temp dir is removed after execute completes (cleanup on teardown).
    await expect(readdir(snap.localDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not resume saved Codex sessions for remote SSH execution without a matching remote identity", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-remote-resume-"));
    cleanupDirs.push(rootDir);
    const workspaceDir = path.join(rootDir, "workspace");
    const codexHomeDir = path.join(rootDir, "codex-home");
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(codexHomeDir, { recursive: true });
    await writeFile(path.join(codexHomeDir, "auth.json"), "{}", "utf8");

    await execute({
      runId: "run-ssh-no-resume",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "CodexCoder",
        adapterType: "codex_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: "session-123",
        sessionParams: {
          sessionId: "session-123",
          cwd: "/remote/workspace",
        },
        sessionDisplayId: "session-123",
        taskKey: null,
      },
      config: {
        engine: "cli",
        command: "codex",
        env: {
          CODEX_HOME: codexHomeDir,
        },
      },
      context: {
        paperclipWorkspace: {
          cwd: workspaceDir,
          source: "project_primary",
        },
      },
      executionTransport: {
        remoteExecution: {
          host: "127.0.0.1",
          port: 2222,
          username: "fixture",
          remoteWorkspacePath: "/remote/workspace",
          remoteCwd: "/remote/workspace",
          privateKey: "PRIVATE KEY",
          knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
          strictHostKeyChecking: true,
        },
      },
      onLog: async () => {},
    });

    expect(runChildProcess).toHaveBeenCalledTimes(1);
    const call = runChildProcess.mock.calls[0] as unknown as [string, string, string[]] | undefined;
    expect(call?.[2].slice(call[2].indexOf("exec"))).toEqual([
      "exec",
      "--json",
      "--dangerously-bypass-approvals-and-sandbox",
      "-",
    ]);
  });

  it("resumes saved Codex sessions for remote SSH execution when the remote identity matches", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-remote-resume-match-"));
    cleanupDirs.push(rootDir);
    const workspaceDir = path.join(rootDir, "workspace");
    const codexHomeDir = path.join(rootDir, "codex-home");
    const managedRemoteWorkspace = "/remote/workspace/.paperclip-runtime/runs/run-ssh-resume/workspace";
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(codexHomeDir, { recursive: true });
    await writeFile(path.join(codexHomeDir, "auth.json"), "{}", "utf8");

    await execute({
      runId: "run-ssh-resume",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "CodexCoder",
        adapterType: "codex_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: "session-123",
        sessionParams: {
          sessionId: "session-123",
          cwd: managedRemoteWorkspace,
          remoteExecution: {
            transport: "ssh",
            host: "127.0.0.1",
            port: 2222,
            username: "fixture",
            remoteCwd: managedRemoteWorkspace,
          },
        },
        sessionDisplayId: "session-123",
        taskKey: null,
      },
      config: {
        engine: "cli",
        command: "codex",
        env: {
          CODEX_HOME: codexHomeDir,
        },
      },
      context: {
        paperclipWorkspace: {
          cwd: workspaceDir,
          source: "project_primary",
        },
      },
      executionTransport: {
        remoteExecution: {
          host: "127.0.0.1",
          port: 2222,
          username: "fixture",
          remoteWorkspacePath: "/remote/workspace",
          remoteCwd: "/remote/workspace",
          privateKey: "PRIVATE KEY",
          knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
          strictHostKeyChecking: true,
        },
      },
      onLog: async () => {},
    });

    expect(runChildProcess).toHaveBeenCalledTimes(1);
    const call = runChildProcess.mock.calls[0] as unknown as [string, string, string[]] | undefined;
    expect(call?.[2].slice(call[2].indexOf("exec"))).toEqual([
      "exec",
      "--json",
      "--dangerously-bypass-approvals-and-sandbox",
      "resume",
      "session-123",
      "-",
    ]);
  });

  it("uses the provider-neutral execution target contract for remote SSH execution", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-target-"));
    cleanupDirs.push(rootDir);
    const workspaceDir = path.join(rootDir, "workspace");
    const codexHomeDir = path.join(rootDir, "codex-home");
    const managedRemoteWorkspace = "/remote/workspace/.paperclip-runtime/runs/run-target/workspace";
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(codexHomeDir, { recursive: true });
    await writeFile(path.join(codexHomeDir, "auth.json"), "{}", "utf8");

    await execute({
      runId: "run-target",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "CodexCoder",
        adapterType: "codex_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: "session-123",
        sessionParams: {
          sessionId: "session-123",
          cwd: managedRemoteWorkspace,
          remoteExecution: {
            transport: "ssh",
            host: "127.0.0.1",
            port: 2222,
            username: "fixture",
            remoteCwd: managedRemoteWorkspace,
          },
        },
        sessionDisplayId: "session-123",
        taskKey: null,
      },
      config: {
        engine: "cli",
        command: "codex",
        env: {
          CODEX_HOME: codexHomeDir,
        },
      },
      context: {
        paperclipWorkspace: {
          cwd: workspaceDir,
          source: "project_primary",
        },
      },
      executionTarget: {
        kind: "remote",
        transport: "ssh",
        remoteCwd: "/remote/workspace",
        spec: {
          host: "127.0.0.1",
          port: 2222,
          username: "fixture",
          remoteWorkspacePath: "/remote/workspace",
          remoteCwd: "/remote/workspace",
          privateKey: "PRIVATE KEY",
          knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
          strictHostKeyChecking: true,
        },
      },
      onLog: async () => {},
    });

    expect(syncDirectoryToSsh).toHaveBeenCalledTimes(1);
    expect(runChildProcess).toHaveBeenCalledTimes(1);
    const call = runChildProcess.mock.calls[0] as unknown as
      | [string, string, string[], { env: Record<string, string>; remoteExecution?: { remoteCwd: string } | null }]
      | undefined;
    expect(call?.[2].slice(call[2].indexOf("exec"))).toEqual([
      "exec",
      "--json",
      "--dangerously-bypass-approvals-and-sandbox",
      "resume",
      "session-123",
      "-",
    ]);
    expect(call?.[3].env.CODEX_HOME).toBe(`${managedRemoteWorkspace}/.paperclip-runtime/codex/home`);
    expect(call?.[3].remoteExecution?.remoteCwd).toBe(managedRemoteWorkspace);
  });

  it("runs in place at the authoritative root without archive prepare or restore", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-in-place-"));
    cleanupDirs.push(rootDir);
    const workspaceDir = path.join(rootDir, "workspace");
    const codexHomeDir = path.join(rootDir, "codex-home");
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(codexHomeDir, { recursive: true });
    await writeFile(path.join(codexHomeDir, "auth.json"), "{}", "utf8");

    await execute({
      runId: "run-in-place",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "CodexCoder",
        adapterType: "codex_local",
        adapterConfig: {},
      },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: { engine: "cli", command: "codex", env: { CODEX_HOME: codexHomeDir } },
      context: {
        paperclipWorkspace: {
          cwd: workspaceDir,
          source: "task_session",
        },
      },
      executionTarget: {
        kind: "remote",
        transport: "ssh",
        remoteCwd: "/copied/workspace",
        workspaceRealization: {
          mode: "in_place",
          authoritativeRoot: "/app",
          pathAliases: [],
          outboundRestorePaths: [],
        },
        spec: {
          host: "127.0.0.1",
          port: 2222,
          username: "fixture",
          remoteWorkspacePath: "/app",
          remoteCwd: "/app",
          privateKey: "PRIVATE KEY",
          knownHosts: "[127.0.0.1]:2222 ssh-ed25519 AAAA",
          strictHostKeyChecking: true,
        },
      },
      onLog: async () => {},
    });

    expect(prepareWorkspaceForSshExecution).not.toHaveBeenCalled();
    expect(syncDirectoryToSsh).toHaveBeenCalledTimes(1);
    expect(restoreWorkspaceFromSshExecution).not.toHaveBeenCalled();
    const homeSyncArgs = (syncDirectoryToSsh.mock.calls[0] as unknown[])?.[0] as {
      localDir: string;
      remoteDir: string;
    };
    expect(homeSyncArgs.localDir).toContain("paperclip-codex-home-sync");
    expect(homeSyncArgs.remoteDir).toBe("/app/.paperclip-runtime/codex/home");
    const call = runChildProcess.mock.calls[0] as unknown as
      | [string, string, string[], { env: Record<string, string>; remoteExecution?: { remoteCwd: string } | null }]
      | undefined;
    expect(call?.[3].env.PAPERCLIP_WORKSPACE_CWD).toBe("/app");
    expect(call?.[3].env.PAPERCLIP_WORKSPACE_REALIZATION_MODE).toBe("in_place");
    expect(call?.[3].env.PAPERCLIP_WORKSPACE_AUTHORITATIVE_ROOT).toBe("/app");
    expect(call?.[3].env.CODEX_HOME).toBe("/app/.paperclip-runtime/codex/home");
    expect(call?.[3].remoteExecution?.remoteCwd).toBe("/app");
  });

  it("reselects the full assignment and bootstrap guidance after a failed resume", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-codex-cli-fallback-context-"));
    cleanupDirs.push(rootDir);
    const workspaceDir = path.join(rootDir, "workspace");
    await mkdir(workspaceDir, { recursive: true });

    runChildProcess
      .mockResolvedValueOnce({
        exitCode: 1,
        signal: null,
        timedOut: false,
        stdout: "",
        stderr: "unknown thread id session-old",
        pid: 123,
        startedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: [
          JSON.stringify({ type: "thread.started", thread_id: "session-fresh" }),
          JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }),
        ].join("\\n"),
        stderr: "",
        pid: 124,
        startedAt: new Date().toISOString(),
      });

    await execute({
      runId: "run-codex-cli-fallback-context",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Codex Coder",
        adapterType: "codex_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: "session-old",
        sessionParams: { sessionId: "session-old", cwd: workspaceDir },
        sessionDisplayId: "session-old",
        taskKey: null,
      },
      config: {
        engine: "cli",
        command: "codex",
        env: { OPENAI_API_KEY: "fixture-openai-key" },
      },
      context: {
        ...createPromptContextFixture(),
        paperclipWorkspace: { cwd: workspaceDir, source: "project_primary" },
      },
      onLog: async () => {},
    });

    expect(runChildProcess).toHaveBeenCalledTimes(2);
    const first = (runChildProcess.mock.calls[0] as unknown as [string, string, string[], { stdin?: string }])[3]?.stdin ?? "";
    const retry = (runChildProcess.mock.calls[1] as unknown as [string, string, string[], { stdin?: string }])[3]?.stdin ?? "";
    expect(first).toContain("## Compact assignment");
    expect(first).not.toContain("Explain the next step before starting work.");
    expect(retry).toContain("## Owned assignment");
    expect(retry).toContain("Explain the next step before starting work.");
    expect(retry).not.toContain("## Compact assignment");
    expect(retry.indexOf("comment-first")).toBeLessThan(retry.indexOf("comment-second"));
    expect(retry.split("Append the same ledger entry.")).toHaveLength(3);
  });

});
