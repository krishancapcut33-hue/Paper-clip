import { describe, expect, it, vi } from "vitest";
import type { Db } from "@paperclipai/db";
import { createAgentIdentityRedactor } from "../agent-identity-redaction.js";
import { createHeartbeatRunOutput, type HeartbeatRunOutputInput } from "./run-output.js";

const FAKE_GITHUB_TOKEN = `ghs_${"FAKEfake0123456789abcdefABCDEF012345"}`;

function createRecordingOutput() {
  const stored: Array<{ stream: string; chunk: string }> = [];
  const db = { update: () => ({ set: () => ({ where: async () => undefined }) }) } as unknown as Db;
  const run = {
    id: "run-1",
    companyId: "company-1",
    agentId: "agent-1",
    status: "running",
    lastOutputSeq: 0,
    lastOutputAt: null,
    logBytes: 0,
  } as unknown as HeartbeatRunOutputInput["run"];
  const output = createHeartbeatRunOutput(db, {
    run,
    runId: run.id,
    issueId: null,
    runLogStore: {
      begin: async () => ({ store: "local_file", logRef: "test-log" }),
      append: async (_handle, entry) => {
        stored.push({ stream: entry.stream, chunk: entry.chunk });
        return entry.chunk.length;
      },
    },
    identityRedactor: createAgentIdentityRedactor(),
    secretKeys: new Set(),
    appendRunEvent: vi.fn(async () => {}) as unknown as HeartbeatRunOutputInput["appendRunEvent"],
    getCurrentUserRedactionOptions: async () => ({ enabled: false }),
  });
  return { output, run, stored };
}

describe("createHeartbeatRunOutput", () => {
  it("redacts a credential split across output chunks and keeps the unfinished last line", async () => {
    const { output, run, stored } = createRecordingOutput();
    const { onLog } = await output.begin(run);

    await onLog("stdout", `  - Token: ${FAKE_GITHUB_TOKEN.slice(0, 14)}`);
    await onLog("stdout", `${FAKE_GITHUB_TOKEN.slice(14)}\nlast line without newline`);
    await onLog("stderr", "Error: exited");
    await output.flushHeldLog();

    const stdout = stored.filter((entry) => entry.stream === "stdout").map((entry) => entry.chunk).join("");
    expect(stdout).toContain("***REDACTED***");
    expect(stdout).not.toContain("FAKEfake");
    expect(stdout.endsWith("last line without newline")).toBe(true);
    expect(output.stdoutExcerpt).toContain("last line without newline");
    expect(output.stderrExcerpt).toContain("Error: exited");
  });

  it("writes the held tail only once", async () => {
    const { output, run, stored } = createRecordingOutput();
    const { onLog } = await output.begin(run);

    await onLog("stdout", "partial");
    await output.flushHeldLog();
    await output.flushHeldLog();

    expect(stored.map((entry) => entry.chunk)).toEqual(["partial"]);
  });
});
