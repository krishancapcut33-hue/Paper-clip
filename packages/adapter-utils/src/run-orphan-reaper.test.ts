import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listRunOrphanProcesses,
  reapRunOrphansForTerminalRun,
  reapRunOrphans,
  registerRecentTerminalRun,
  resetRunOrphanReaperForTests,
  resumeRunOrphanReaperForTests,
  RUN_ORPHAN_REAPER_METRIC,
  stopRunOrphanReaper,
  sweepRecentlyTerminalRuns,
} from "./run-orphan-reaper.js";
import { runChildProcess, runningProcesses } from "./server-utils.js";

const posixNonRoot =
  typeof process.getuid === "function" && process.getuid() !== 0;
const linuxNonRoot = process.platform === "linux" && posixNonRoot;

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPidExit(pid: number, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !isPidAlive(pid);
}

async function waitForPidFrom(read: () => string, timeoutMs = 3_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = read().match(/child:(\d+)/);
    if (match) return Number.parseInt(match[1], 10);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("the child never reported its descendant pid");
}

async function forceKill(pid: number) {
  if (!isPidAlive(pid)) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Already gone.
  }
}

/**
 * Spawn a detached process that has installed its SIGTERM handler. Waiting for
 * the ready line removes the startup race: without it the first SIGTERM can land
 * before the handler exists and kill the process, which would hide a missing
 * SIGKILL escalation.
 */
async function spawnSigtermIgnoringProcess(
  runId: string,
  extraEnv: Record<string, string> = {},
): Promise<number> {
  const child = spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM', () => {}); process.stdout.write('ready\\n'); setInterval(() => {}, 1000);"],
    {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, ...extraEnv, PAPERCLIP_RUN_ID: runId },
    },
  );
  await new Promise<void>((resolve, reject) => {
    child.stdout?.once("data", () => resolve());
    child.once("error", reject);
  });
  child.stdout?.removeAllListeners();
  child.stdout?.destroy();
  child.unref();
  return child.pid as number;
}

/**
 * Build a fake `/proc` tree with only the fields the reaper reads: the pid
 * directory itself, `stat`, `environ`, and `cmdline`.
 */
async function writeFakeProcProcess(input: {
  procRoot: string;
  pid: number;
  ppid: number;
  state?: string;
  startTime: string;
  env?: string;
  cmdline?: string;
}) {
  const dir = path.join(input.procRoot, String(input.pid));
  await fs.mkdir(dir, { recursive: true });
  // Rest after the last `)` maps index 0 to field 3 (state), index 1 to field
  // 4 (ppid), and index 19 to field 22 (starttime).
  const rest = Array.from({ length: 24 }, () => "0");
  rest[0] = input.state ?? "S";
  rest[1] = String(input.ppid);
  rest[19] = input.startTime;
  await fs.writeFile(path.join(dir, "stat"), `${input.pid} (fake proc) ${rest.join(" ")}\n`);
  await fs.writeFile(path.join(dir, "environ"), Buffer.from(input.env ?? ""));
  await fs.writeFile(path.join(dir, "cmdline"), Buffer.from(input.cmdline ?? "fake\0command\0"));
}

describe("listRunOrphanProcesses", () => {
  let tempRoot: string | null = null;

  afterEach(async () => {
    resetRunOrphanReaperForTests();
    if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  });

  async function fakeProc() {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-reaper-proc-"));
    return tempRoot;
  }

  it.skipIf(!posixNonRoot)("selects only the exact run marker and excludes self and ancestors", async () => {
    const procRoot = await fakeProc();
    const runId = "run-select";
    // Ancestor chain: 1000 (self) -> 900 -> 1.
    await writeFakeProcProcess({ procRoot, pid: 1000, ppid: 900, startTime: "10", env: "PAPERCLIP_RUN_ID=run-select\0" });
    await writeFakeProcProcess({ procRoot, pid: 900, ppid: 1, startTime: "9", env: "PAPERCLIP_RUN_ID=run-select\0" });
    await writeFakeProcProcess({ procRoot, pid: 2000, ppid: 1000, startTime: "20", env: "PAPERCLIP_RUN_ID=run-select\0", cmdline: "sleep\u0000300\u0000" });
    await writeFakeProcProcess({ procRoot, pid: 2001, ppid: 1, startTime: "21", env: "PAPERCLIP_RUN_ID=other-run\0" });
    await writeFakeProcProcess({ procRoot, pid: 2002, ppid: 1, startTime: "22", state: "Z", env: "PAPERCLIP_RUN_ID=run-select\0" });
    await writeFakeProcProcess({ procRoot, pid: 2003, ppid: 1, startTime: "23", env: "PAPERCLIP_RUN_ID=run-select-extra\0" });
    await writeFakeProcProcess({ procRoot, pid: 2004, ppid: 1, startTime: "24", env: "X=1\0NOT_PAPERCLIP_RUN_ID=run-select\0" });

    const result = await listRunOrphanProcesses({
      runId,
      procRoot,
      selfPid: 1000,
      platform: "linux",
      uid: (await fs.stat(procRoot)).uid,
    });
    expect(result.supported).toBe(true);
    expect(result.processes.map((process) => process.pid)).toEqual([2000]);
    expect(result.processes[0]).toMatchObject({ ppid: 1000, startTime: "20", command: "sleep 300" });
  });

  it.skipIf(!posixNonRoot)("bounds the number of selected PIDs", async () => {
    const procRoot = await fakeProc();
    const runId = "run-bound";
    await writeFakeProcProcess({ procRoot, pid: 1000, ppid: 1, startTime: "1" });
    for (let index = 0; index < 6; index += 1) {
      await writeFakeProcProcess({
        procRoot,
        pid: 3000 + index,
        ppid: 1,
        startTime: String(30 + index),
        env: `PAPERCLIP_RUN_ID=${runId}\0`,
      });
    }

    const result = await listRunOrphanProcesses({
      runId,
      procRoot,
      selfPid: 1000,
      maxProcesses: 4,
      platform: "linux",
      uid: (await fs.stat(procRoot)).uid,
    });
    expect(result.processes).toHaveLength(4);
  });

  it.skipIf(!posixNonRoot)("requires the per-invocation token when one is given", async () => {
    const procRoot = await fakeProc();
    const runId = "run-token";
    await writeFakeProcProcess({ procRoot, pid: 1000, ppid: 1, startTime: "1" });
    await writeFakeProcProcess({
      procRoot,
      pid: 4000,
      ppid: 1,
      startTime: "40",
      env: `PAPERCLIP_RUN_ID=${runId}\0PAPERCLIP_RUN_PROCESS_TOKEN=probe\0`,
    });
    await writeFakeProcProcess({
      procRoot,
      pid: 4001,
      ppid: 1,
      startTime: "41",
      env: `PAPERCLIP_RUN_ID=${runId}\0PAPERCLIP_RUN_PROCESS_TOKEN=main\0`,
    });

    const probe = await listRunOrphanProcesses({
      runId,
      processToken: "probe",
      procRoot,
      selfPid: 1000,
      platform: "linux",
      uid: (await fs.stat(procRoot)).uid,
    });
    expect(probe.processes.map((process) => process.pid)).toEqual([4000]);
  });

  it.skipIf(!posixNonRoot)("redacts credentials in the audited command line", async () => {
    const procRoot = await fakeProc();
    const runId = "run-redact";
    await writeFakeProcProcess({ procRoot, pid: 1000, ppid: 1, startTime: "1" });
    await writeFakeProcProcess({
      procRoot,
      pid: 5000,
      ppid: 1,
      startTime: "50",
      env: `PAPERCLIP_RUN_ID=${runId}\0`,
      cmdline: "tool\0--api-key=super-secret-value\0",
    });

    const result = await listRunOrphanProcesses({
      runId,
      procRoot,
      selfPid: 1000,
      platform: "linux",
      uid: (await fs.stat(procRoot)).uid,
    });
    expect(result.processes).toHaveLength(1);
    expect(result.processes[0].command).not.toContain("super-secret-value");
    expect(result.processes[0].command).toContain("***REDACTED***");
  });

  it("refuses to run as root and on non-Linux platforms", async () => {
    const procRoot = await fakeProc();
    const asRoot = await listRunOrphanProcesses({ runId: "run-a", procRoot, selfPid: 1000, uid: 0 });
    expect(asRoot.supported).toBe(false);
    expect(asRoot.reason).toContain("root");

    const nonLinux = await listRunOrphanProcesses({ runId: "run-a", procRoot, selfPid: 1000, platform: "darwin" });
    expect(nonLinux.supported).toBe(false);
    expect(nonLinux.reason).toContain("/proc");
  });
});

describe.skipIf(!linuxNonRoot)("reapRunOrphans", () => {
  afterEach(() => {
    resetRunOrphanReaperForTests();
  });

  it("emits an audit/alert record with the metric name and no environment content", async () => {
    const runId = randomUUID();
    const pid = await spawnSigtermIgnoringProcess(runId, { REAPER_TEST_SECRET: "do-not-log-this" });
    const lines: string[] = [];
    try {
      const result = await reapRunOrphans({
        runId,
        graceMs: 100,
        writeAlert: (line) => lines.push(line),
      });
      expect(result.found).toBeGreaterThanOrEqual(1);
      expect(result.survivors).toBe(0);
      expect(await waitForPidExit(pid)).toBe(true);

      expect(lines).toHaveLength(1);
      const alert = JSON.parse(lines[0]);
      expect(alert.metric).toBe(RUN_ORPHAN_REAPER_METRIC);
      expect(alert.runId).toBe(runId);
      expect(alert.pids).toContain(pid);
      expect(alert.commands[0]).toContain(process.execPath);
      expect(lines[0]).not.toContain("do-not-log-this");
    } finally {
      await forceKill(pid);
    }
  });

  it("escalates to SIGKILL for a process that ignores SIGTERM", async () => {
    const runId = randomUUID();
    const pid = await spawnSigtermIgnoringProcess(runId);
    try {
      const result = await reapRunOrphans({ runId, graceMs: 100 });
      expect(result.found).toBeGreaterThanOrEqual(1);
      expect(result.survivors).toBe(0);
      expect(await waitForPidExit(pid)).toBe(true);
    } finally {
      await forceKill(pid);
    }
  });
});

describe.skipIf(!linuxNonRoot)("runChildProcess terminal reaping", () => {
  afterEach(() => {
    resetRunOrphanReaperForTests();
  });

  it.skipIf(process.platform === "win32")(
    "reaps a setsid descendant after a successful run",
    async () => {
      const runId = randomUUID();
      let observed = "";
      const result = await runChildProcess(
        runId,
        process.execPath,
        [
          "-e",
          [
            "const { spawn } = require('node:child_process');",
            `const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore', env: { ...process.env, PAPERCLIP_RUN_ID: ${JSON.stringify(runId)} } });`,
            "child.unref();",
            "process.stdout.write('child:' + child.pid);",
          ].join(" "),
        ],
        {
          cwd: process.cwd(),
          env: { PAPERCLIP_RUN_ID: runId },
          timeoutSec: 5,
          graceSec: 1,
          onLog: async (stream, chunk) => {
            if (stream === "stdout") observed += chunk;
          },
        },
      );

      const descendantPid = await waitForPidFrom(() => observed);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain(RUN_ORPHAN_REAPER_METRIC);
      expect(result.stderr).toContain(`pids=${descendantPid}`);
      expect(await waitForPidExit(descendantPid)).toBe(true);
    },
  );

  it.skipIf(process.platform === "win32")(
    "resolves a clean exit when a preserved descendant inherited the stdio pipes",
    async () => {
      const runId = randomUUID();
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-inherited-pipes-"));
      const pidFile = path.join(dir, "pid");
      let descendantPid = 0;
      try {
        const result = await runChildProcess(
          runId,
          process.execPath,
          [
            "-e",
            [
              "const fs = require('node:fs');",
              "const { spawn } = require('node:child_process');",
              "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: false, stdio: 'inherit', env: process.env });",
              "child.unref();",
              `fs.writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));`,
            ].join(" "),
          ],
          {
            cwd: process.cwd(),
            env: { PAPERCLIP_RUN_ID: runId },
            timeoutSec: 5,
            graceSec: 1,
            onLog: async () => {},
          },
        );

        // Without closing the inherited pipes, this promise would not settle
        // until the descendant exits or the timeout fires.
        expect(result.exitCode).toBe(0);
        expect(result.timedOut).toBe(false);
        descendantPid = Number.parseInt(await fs.readFile(pidFile, "utf8"), 10);
        expect(Number.isInteger(descendantPid) && descendantPid > 0).toBe(true);
        expect(isPidAlive(descendantPid)).toBe(true);
      } finally {
        await forceKill(descendantPid);
        await fs.rm(dir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "leaves a same-group marker descendant to platform settlement on a clean exit",
    async () => {
      const runId = randomUUID();
      let observed = "";
      let descendantPid = 0;
      try {
        const result = await runChildProcess(
          runId,
          process.execPath,
          [
            "-e",
            [
              "const { spawn } = require('node:child_process');",
              "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: false, stdio: 'ignore', env: process.env });",
              "child.unref();",
              "process.stdout.write('child:' + child.pid);",
            ].join(" "),
          ],
          {
            cwd: process.cwd(),
            env: { PAPERCLIP_RUN_ID: runId },
            timeoutSec: 5,
            graceSec: 1,
            onLog: async (stream, chunk) => {
              if (stream === "stdout") observed += chunk;
            },
          },
        );

        descendantPid = await waitForPidFrom(() => observed);
        expect(result.exitCode).toBe(0);
        // The case-handoff source run keeps a same-group writer alive after the
        // adapter exits. The reaper must not preempt that handoff settlement.
        expect(isPidAlive(descendantPid)).toBe(true);
      } finally {
        await forceKill(descendantPid);
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "reaps the exact setsid grandchild from the P8 contract after a successful run",
    async () => {
      const runId = randomUUID();
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-setsid-grandchild-"));
      const pidFile = path.join(dir, "pid");
      try {
        const result = await runChildProcess(
          runId,
          "bash",
          ["-c", `setsid bash -c 'sleep 300 >/dev/null 2>&1 & echo $! > '${pidFile}`],
          {
            cwd: process.cwd(),
            env: { PAPERCLIP_RUN_ID: runId },
            timeoutSec: 5,
            graceSec: 1,
            onLog: async () => {},
          },
        );

        expect(result.exitCode).toBe(0);
        const descendantPid = Number.parseInt(await fs.readFile(pidFile, "utf8"), 10);
        expect(Number.isInteger(descendantPid) && descendantPid > 0).toBe(true);
        expect(await waitForPidExit(descendantPid)).toBe(true);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "reaps a setsid descendant after a timeout",
    async () => {
      const runId = randomUUID();
      let observed = "";
      const result = await runChildProcess(
        runId,
        process.execPath,
        [
          "-e",
          [
            "const { spawn } = require('node:child_process');",
            `const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore', env: { ...process.env, PAPERCLIP_RUN_ID: ${JSON.stringify(runId)} } });`,
            "child.unref();",
            "process.stdout.write('child:' + child.pid);",
            "setInterval(() => {}, 1000);",
          ].join(" "),
        ],
        {
          cwd: process.cwd(),
          env: { PAPERCLIP_RUN_ID: runId },
          timeoutSec: 1,
          graceSec: 1,
          onLog: async (stream, chunk) => {
            if (stream === "stdout") observed += chunk;
          },
        },
      );

      const descendantPid = await waitForPidFrom(() => observed);
      expect(result.timedOut).toBe(true);
      expect(await waitForPidExit(descendantPid)).toBe(true);
    },
  );

  it.skipIf(process.platform === "win32")(
    "reaps a setsid descendant after an external cancel",
    async () => {
      const runId = randomUUID();
      let observed = "";
      const resultPromise = runChildProcess(
        runId,
        process.execPath,
        [
          "-e",
          [
            "const { spawn } = require('node:child_process');",
            `const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore', env: { ...process.env, PAPERCLIP_RUN_ID: ${JSON.stringify(runId)} } });`,
            "child.unref();",
            "process.stdout.write('child:' + child.pid);",
            "setInterval(() => {}, 1000);",
          ].join(" "),
        ],
        {
          cwd: process.cwd(),
          env: { PAPERCLIP_RUN_ID: runId },
          timeoutSec: 0,
          graceSec: 1,
          onLog: async (stream, chunk) => {
            if (stream === "stdout") observed += chunk;
          },
        },
      );

      const descendantPid = await waitForPidFrom(() => observed);
      const running = runningProcesses.get(runId);
      expect(running).toBeDefined();
      // This is what the heartbeat Stop path does: terminate the tracked
      // handle/group, then let the run settle.
      if (running?.processGroupId) process.kill(-running.processGroupId, "SIGTERM");
      else running?.child.kill("SIGTERM");

      const result = await resultPromise;
      expect(result.signal).toBe("SIGTERM");
      expect(await waitForPidExit(descendantPid)).toBe(true);
    },
  );

  it.skipIf(process.platform === "win32")(
    "uses the process-group fallback after an abnormal stop when a descendant cleared its environment",
    async () => {
      const runId = randomUUID();
      let observed = "";
      const resultPromise = runChildProcess(
        runId,
        process.execPath,
        [
          "-e",
          [
            "const { spawn } = require('node:child_process');",
            "const child = spawn('/usr/bin/env', ['-i', '/bin/sleep', '300'], { detached: false, stdio: 'ignore', env: process.env });",
            "child.unref();",
            "process.stdout.write('child:' + child.pid);",
            "setInterval(() => {}, 1000);",
          ].join(" "),
        ],
        {
          cwd: process.cwd(),
          env: { PAPERCLIP_RUN_ID: runId },
          timeoutSec: 0,
          graceSec: 1,
          onLog: async (stream, chunk) => {
            if (stream === "stdout") observed += chunk;
          },
        },
      );

      const descendantPid = await waitForPidFrom(() => observed);
      const running = runningProcesses.get(runId);
      expect(running).toBeDefined();
      // Kill only the direct child, so the env-cleared descendant survives in
      // the group until the reaper's fallback runs.
      running?.child.kill("SIGTERM");

      const result = await resultPromise;
      expect(result.signal).toBe("SIGTERM");
      expect(await waitForPidExit(descendantPid)).toBe(true);
    },
  );

  it.skipIf(process.platform === "win32")(
    "does not group-kill background infrastructure after a clean exit",
    async () => {
      const runId = randomUUID();
      let observed = "";
      let descendantPid = 0;
      try {
        const result = await runChildProcess(
          runId,
          process.execPath,
          [
            "-e",
            [
              "const { spawn } = require('node:child_process');",
              "const child = spawn('/usr/bin/env', ['-i', '/bin/sleep', '300'], { detached: false, stdio: 'ignore', env: process.env });",
              "child.unref();",
              "process.stdout.write('child:' + child.pid);",
            ].join(" "),
          ],
          {
            cwd: process.cwd(),
            env: { PAPERCLIP_RUN_ID: runId },
            timeoutSec: 5,
            graceSec: 1,
            onLog: async (stream, chunk) => {
              if (stream === "stdout") observed += chunk;
            },
          },
        );

        descendantPid = await waitForPidFrom(() => observed);
        expect(result.exitCode).toBe(0);
        // The sandbox callback bridge is started this way. A clean run must not
        // kill its own background control server.
        expect(isPidAlive(descendantPid)).toBe(true);
      } finally {
        await forceKill(descendantPid);
      }
    },
  );
});

describe.skipIf(!linuxNonRoot)("sweepRecentlyTerminalRuns", () => {
  afterEach(() => {
    resetRunOrphanReaperForTests();
  });

  it("reaps a descendant that forks after the terminal pass", async () => {
    const runId = randomUUID();
    const now = Date.now();
    registerRecentTerminalRun({ runId, graceMs: 0, windowMs: 10_000, now });

    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PAPERCLIP_RUN_ID: runId },
    });
    child.unref();
    const pid = child.pid as number;
    try {
      const first = await sweepRecentlyTerminalRuns(now + 10);
      expect(first.found).toBeGreaterThanOrEqual(1);
      expect(await waitForPidExit(pid)).toBe(true);
    } finally {
      await forceKill(pid);
    }
  });

  it("does not reap a later invocation that shares the run id but not the process token", async () => {
    const runId = randomUUID();
    const now = Date.now();
    registerRecentTerminalRun({
      runId,
      processToken: "probe-invocation",
      graceMs: 0,
      windowMs: 10_000,
      now,
    });

    // This models the real adapter process that starts after the probe: same
    // run id, different invocation. The probe's sweep must not kill it.
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PAPERCLIP_RUN_ID: runId,
        PAPERCLIP_RUN_PROCESS_TOKEN: "main-invocation",
      },
    });
    child.unref();
    const pid = child.pid as number;
    try {
      const result = await sweepRecentlyTerminalRuns(now + 10);
      expect(result.found).toBe(0);
      expect(isPidAlive(pid)).toBe(true);
    } finally {
      await forceKill(pid);
    }
  });

  it("reaps multiple tracked runs in one sweep pass", async () => {
    const firstRun = randomUUID();
    const secondRun = randomUUID();
    const now = Date.now();
    registerRecentTerminalRun({ runId: firstRun, graceMs: 0, windowMs: 10_000, now });
    registerRecentTerminalRun({ runId: secondRun, graceMs: 0, windowMs: 10_000, now });

    const spawnRunChild = (runId: string) =>
      spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, PAPERCLIP_RUN_ID: runId },
      });
    const first = spawnRunChild(firstRun);
    const second = spawnRunChild(secondRun);
    first.unref();
    second.unref();
    try {
      const result = await sweepRecentlyTerminalRuns(now + 10);
      expect(result.scanned).toBe(2);
      expect(result.found).toBeGreaterThanOrEqual(2);
      expect(await waitForPidExit(first.pid as number)).toBe(true);
      expect(await waitForPidExit(second.pid as number)).toBe(true);
    } finally {
      await forceKill(first.pid as number);
      await forceKill(second.pid as number);
    }
  });

  it("drops a run after its window expires", async () => {
    const runId = randomUUID();
    const now = Date.now();
    registerRecentTerminalRun({ runId, windowMs: 100, now });
    const result = await sweepRecentlyTerminalRuns(now + 1_000);
    expect(result.scanned).toBe(0);
  });
});

describe("reapRunOrphansForTerminalRun", () => {
  afterEach(async () => {
    await stopRunOrphanReaper();
    resetRunOrphanReaperForTests();
    resumeRunOrphanReaperForTests();
  });

  it("reports cleanup unavailable instead of a false green when it cannot scan", async () => {
    const listed = await listRunOrphanProcesses({ runId: "run-a", platform: "win32" });
    expect(listed.supported).toBe(false);
    const reaped = await reapRunOrphans({ runId: "run-a", platform: "win32" });
    expect(reaped.supported).toBe(false);
    expect(reaped.reason).toBeTruthy();
  });

  it("stops and drains the sweep on host shutdown", async () => {
    registerRecentTerminalRun({ runId: randomUUID(), windowMs: 10_000 });
    await stopRunOrphanReaper();
    const result = await sweepRecentlyTerminalRuns(Date.now());
    expect(result.scanned).toBe(0);
    resumeRunOrphanReaperForTests();
  });
});
