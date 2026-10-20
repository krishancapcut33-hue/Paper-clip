import { describe, expect, it, vi } from "vitest";
import { SemanticToolOutcomeUnknownError } from "../../vendor/paperclip-runner/index.js";
import { captureRunnerToolResult } from "./runner-tool-results.js";

describe("assigned tool result capture", () => {
  it("leaves small governed results inline without storage admission", async () => {
    const result = { data: { untrusted: true, content: "small result" } };
    const io = { reserveResponseCapture: vi.fn(), saveResponse: vi.fn() };
    expect(await captureRunnerToolResult(result, io)).toBe(result);
    expect(io.reserveResponseCapture).not.toHaveBeenCalled();
    expect(io.saveResponse).not.toHaveBeenCalled();
  });

  it.each(["reserve", "save", "settle"])("preserves completed actions as uncertain when %s fails", async stage => {
    const fail = async () => { throw new Error("private provider response must not be exposed"); };
    const settle = vi.fn(stage === "settle" ? fail : async () => undefined);
    const io = {
      reserveResponseCapture: vi.fn(stage === "reserve" ? fail : async () => settle),
      saveResponse: vi.fn(stage === "save" ? fail : async () => ({ artifactId: "saved" })),
    };
    const error = await captureRunnerToolResult({ content: "x".repeat(600_000) }, io).catch(error => error);
    expect(error).toBeInstanceOf(SemanticToolOutcomeUnknownError);
    expect(error).toMatchObject({ message: "The completed app-tool result could not be saved." });
    expect(io.reserveResponseCapture).toHaveBeenCalledOnce();
    expect(io.saveResponse).toHaveBeenCalledTimes(stage === "reserve" ? 0 : 1);
  });
});
