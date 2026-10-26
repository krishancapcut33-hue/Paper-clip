import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProjectService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createWorkspace: vi.fn(),
  listWorkspaces: vi.fn(),
  updateWorkspace: vi.fn(),
  removeWorkspace: vi.fn(),
  remove: vi.fn(),
  resolveByReference: vi.fn(),
}));
const mockSecretService = vi.hoisted(() => ({
  normalizeEnvBindingsForPersistence: vi.fn(),
}));
const mockEnvironmentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));
const mockWorkspaceOperationService = vi.hoisted(() => ({}));
const mockHeartbeatService = vi.hoisted(() => ({
  cancelRun: vi.fn(),
  waitForRunExecutionDrain: vi.fn(),
}));
const mockLogActivity = vi.hoisted(() => vi.fn());
const mockGetTelemetryClient = vi.hoisted(() => vi.fn());
const mockAccessService = vi.hoisted(() => ({
  decide: vi.fn(),
}));

vi.mock("../telemetry.js", () => ({
  getTelemetryClient: mockGetTelemetryClient,
}));

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  environmentService: () => mockEnvironmentService,
  heartbeatService: () => mockHeartbeatService,
  logActivity: mockLogActivity,
  projectService: () => mockProjectService,
  secretService: () => mockSecretService,
  workspaceOperationService: () => mockWorkspaceOperationService,
}));

vi.mock("../services/environments.js", () => ({
  environmentService: () => mockEnvironmentService,
}));

vi.mock("../services/secrets.js", () => ({
  secretService: () => mockSecretService,
}));

vi.mock("../services/workspace-runtime.js", () => ({
  startRuntimeServicesForWorkspaceControl: vi.fn(),
  stopRuntimeServicesForExecutionWorkspace: vi.fn(),
  stopRuntimeServicesForProjectWorkspace: vi.fn(),
}));

function registerModuleMocks() {
  vi.doMock("../services/activity-log.js", async () => ({
    ...await vi.importActual<typeof import("../services/activity-log.js")>("../services/activity-log.js"),
    persistActivity: async (db: unknown, input: unknown) => { await mockLogActivity(db, input); return { activity: { id: "activity" }, publication: null }; },
    publishActivity: vi.fn(),
  }));
  vi.doMock("../telemetry.js", () => ({
    getTelemetryClient: mockGetTelemetryClient,
  }));

  vi.doMock("../services/index.js", () => ({
    accessService: () => mockAccessService,
    environmentService: () => mockEnvironmentService,
    heartbeatService: () => mockHeartbeatService,
    logActivity: mockLogActivity,
    projectService: () => mockProjectService,
    secretService: () => mockSecretService,
    workspaceOperationService: () => mockWorkspaceOperationService,
  }));

  vi.doMock("../services/environments.js", () => ({
    environmentService: () => mockEnvironmentService,
  }));

  vi.doMock("../services/secrets.js", () => ({
    secretService: () => mockSecretService,
  }));

  vi.doMock("../services/workspace-runtime.js", () => ({
    startRuntimeServicesForWorkspaceControl: vi.fn(),
    stopRuntimeServicesForExecutionWorkspace: vi.fn(),
    stopRuntimeServicesForProjectWorkspace: vi.fn(),
  }));
}

async function createApp(
  database: Record<string, any> = {
    transaction: async (effect: (tx: unknown) => unknown) => effect({}),
  },
) {
  const [{ projectRoutes }, { errorHandler }] = await Promise.all([
    vi.importActual<typeof import("../routes/projects.js")>("../routes/projects.js"),
    vi.importActual<typeof import("../middleware/index.js")>("../middleware/index.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "board-user",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", projectRoutes(database as any));
  app.use(errorHandler);
  return app;
}

function buildProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    companyId: "company-1",
    urlKey: "project-1",
    goalId: null,
    goalIds: [],
    goals: [],
    name: "Project",
    description: null,
    status: "backlog",
    leadAgentId: null,
    targetDate: null,
    color: null,
    env: null,
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "/tmp/project",
      effectiveLocalFolder: "/tmp/project",
      origin: "managed_checkout",
    },
    workspaces: [],
    primaryWorkspace: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("project env routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../routes/projects.js");
    vi.doUnmock("../routes/authz.js");
    vi.doUnmock("../middleware/index.js");
    vi.doUnmock("../services/environments.js");
    vi.doUnmock("../services/secrets.js");
    registerModuleMocks();
    vi.clearAllMocks();
    mockAccessService.decide.mockResolvedValue({
      allowed: true,
      action: "project:read",
      reason: "allow_test",
      explanation: "Allowed by test mock.",
    });
    mockGetTelemetryClient.mockReturnValue({ track: vi.fn() });
    mockProjectService.resolveByReference.mockResolvedValue({ ambiguous: false, project: null });
    mockProjectService.createWorkspace.mockResolvedValue(null);
    mockProjectService.listWorkspaces.mockResolvedValue([]);
    mockEnvironmentService.getById.mockReset();
    mockSecretService.normalizeEnvBindingsForPersistence.mockImplementation(async (_companyId, env) => env);
  });

  it('requires workspace-write authority to attach a repository despite project read access', async () => {
    mockProjectService.getById.mockResolvedValue(buildProject());
    mockAccessService.decide.mockImplementation(async (input) => ({ allowed: input.action !== 'project:write_workspace',
      action: input.action, reason: 'deny_no_grant', explanation: 'Workspace write permission required.' }));
    const app = await createApp();
    await request(app).post('/api/projects/project-1/workspaces').send({ name: 'Repository', repoUrl: 'https://github.com/acme/skills' }).expect(403);
    await request(app).put('/api/projects/project-1/repositories').send({ repositoryIds: ['42'] }).expect(403);
    expect(mockProjectService.createWorkspace).not.toHaveBeenCalled();
  });

  it("normalizes env bindings on create and logs only env keys", async () => {
    const normalizedEnv = {
      API_KEY: {
        type: "secret_ref",
        secretId: "11111111-1111-4111-8111-111111111111",
        version: "latest",
      },
    };
    mockSecretService.normalizeEnvBindingsForPersistence.mockResolvedValue(normalizedEnv);
    mockProjectService.create.mockResolvedValue(buildProject({ env: normalizedEnv }));

    const app = await createApp();
    const res = await request(app)
      .post("/api/companies/company-1/projects")
      .send({
        name: "Project",
        env: normalizedEnv,
      });

    expect([200, 201], JSON.stringify(res.body)).toContain(res.status);
    expect(mockSecretService.normalizeEnvBindingsForPersistence).toHaveBeenCalledWith(
      "company-1",
      normalizedEnv,
      expect.objectContaining({ fieldPath: "env" }),
    );
    expect(mockProjectService.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ env: normalizedEnv }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        details: expect.objectContaining({
          envKeys: ["API_KEY"],
        }),
      }),
    );
  });

  it("normalizes env bindings on update and avoids logging raw values", async () => {
    const normalizedEnv = {
      PLAIN_KEY: { type: "plain", value: "top-secret" },
    };
    mockSecretService.normalizeEnvBindingsForPersistence.mockResolvedValue(normalizedEnv);
    mockProjectService.getById.mockResolvedValue(buildProject());
    mockProjectService.update.mockResolvedValue(buildProject({ env: normalizedEnv }));

    const app = await createApp();
    const res = await request(app)
      .patch("/api/projects/project-1")
      .send({
        env: normalizedEnv,
      });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        details: {
          changedKeys: ["env"],
          envKeys: ["PLAIN_KEY"],
        },
      }),
    );
  });

  it.each([false, true])("allows only one concurrent project deletion claim and keeps the project fenced after stop failure (cleanup: %s)", async (deleteFiles) => {
    let status = deleteFiles ? "backlog" : "deleting";
    let claimHeld = false;
    let releaseStop!: () => void;
    let stopStarted!: () => void;
    const stopGate = new Promise<void>((resolve) => { releaseStop = resolve; });
    const stopStartedGate = new Promise<void>((resolve) => { stopStarted = resolve; });
    mockProjectService.getById.mockImplementation(async () => buildProject({ status }));
    mockHeartbeatService.cancelRun.mockReset();
    mockHeartbeatService.waitForRunExecutionDrain.mockImplementation(async () => {
      stopStarted();
      await stopGate;
      throw new Error("Timed out waiting for heartbeat run run-1");
    });

    let selectCount = 0;
    const query = () => {
      const rows = selectCount++ === 1 ? [{ id: "run-1" }] : [];
      return { from: () => ({ where: async () => rows }) };
    };
    const update = () => {
      let nextStatus: string | undefined;
      return {
        set: (value: { status: string }) => {
          nextStatus = value.status;
          return {
            where: () => {
              if (nextStatus !== "deleting" && status === "deleting") status = nextStatus ?? status;
              return Object.assign(Promise.resolve([]), {
                returning: async () => {
                  if (nextStatus === "deleting") {
                    if (claimHeld) return [];
                    claimHeld = true;
                    status = "deleting";
                    return [{ id: "project-1" }];
                  }
                  return [];
                },
              });
            },
          };
        },
      };
    };
    const database = {
      select: () => query(),
      update,
      transaction: async (effect: (tx: unknown) => unknown) => effect({ update }),
    };
    const app = await createApp(database);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const firstDelete = request(baseUrl)
        .delete(`/api/projects/project-1?deleteFiles=${deleteFiles}`)
        .then((response) => response);
      await stopStartedGate;

      const competingDelete = await request(baseUrl).delete("/api/projects/project-1");
      expect(competingDelete.status).toBe(409);
      expect(competingDelete.body.error).toContain("already in progress");
      expect(mockProjectService.remove).not.toHaveBeenCalled();

      releaseStop();
      const firstResult = await firstDelete;
      expect(firstResult.status).toBe(409);
      expect(status).toBe("deleting");
      expect(mockProjectService.remove).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it.each(["cancelled", "running"])("recovers a fenced project with database-only deletion after draining a %s run", async (runStatus) => {
    const expiredClaimToken = "expired-claim";
    mockProjectService.getById.mockResolvedValue(buildProject({
      status: "deleting",
      deletionClaimToken: expiredClaimToken,
      deletionClaimExpiresAt: new Date(Date.now() - 1_000),
    }));
    mockProjectService.remove.mockResolvedValue(buildProject({ fileCleanup: "not_requested" }));
    mockHeartbeatService.cancelRun.mockResolvedValue(undefined);
    let releaseDrain!: () => void;
    let drainStarted!: () => void;
    const drainGate = new Promise<void>((resolve) => { releaseDrain = resolve; });
    const drainStartedGate = new Promise<void>((resolve) => { drainStarted = resolve; });
    mockHeartbeatService.waitForRunExecutionDrain.mockImplementation(async () => {
      drainStarted();
      await drainGate;
    });

    let claimToken: string | null = null;
    let selectCount = 0;
    const update = vi.fn(() => ({
      set: (value: { deletionClaimToken: string }) => {
        claimToken = value.deletionClaimToken;
        return { where: () => ({ returning: async () => [{ id: "project-1" }] }) };
      },
    }));
    const database = {
      update,
      transaction: async (effect: (tx: unknown) => unknown) => effect({ update }),
      select: () => ({
        from: () => ({
          where: () => {
            const rows = selectCount++ === 1 ? [{ id: "run-1", status: runStatus }] : [];
            return Object.assign(Promise.resolve(rows), {
              limit: async () => [{ id: "project-1", expiresAt: new Date(Date.now() + 60_000) }],
            });
          },
        }),
      }),
    };
    const app = await createApp(database);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const pendingDelete = request(`http://127.0.0.1:${address.port}`)
      .delete("/api/projects/project-1").then((response) => response);
    try {
      await drainStartedGate;
      expect(claimToken).toEqual(expect.any(String));
      expect(claimToken).not.toBe(expiredClaimToken);
      expect(mockProjectService.remove).not.toHaveBeenCalled();
    } finally {
      releaseDrain();
      await pendingDelete;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    const result = await pendingDelete;
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.fileCleanup).toBe("not_requested");
    expect(mockProjectService.remove).toHaveBeenCalledWith("project-1", {
      deleteFiles: false,
      deletionClaimToken: claimToken,
    });
    expect(mockHeartbeatService.waitForRunExecutionDrain).toHaveBeenCalledWith("run-1", { timeoutMs: 30_000 });
    if (runStatus === "running") {
      expect(mockHeartbeatService.cancelRun).toHaveBeenCalledWith("run-1", expect.any(String));
    } else {
      expect(mockHeartbeatService.cancelRun).not.toHaveBeenCalled();
    }
  });
});
