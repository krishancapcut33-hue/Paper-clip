import { describe, expect, it } from "vitest";
import { validateRetainedRunnerResult } from "../result-validation.js";
import { renderCaseOutcome } from "../case-outcome.js";
import type { RunnerE2EResult } from "../types.js";
import type { OnboardingPreAcceptanceEvidence } from "./onboarding-pre-acceptance.js";

function result(): RunnerE2EResult {
  return { schema: "paperclip.runner-e2e.result/v2", suiteId: "product-journeys", suiteDefinitionHash: "test",
    executionId: "product-journeys.qa.runner-codex.local.cloud-onboarding", profileId: "runner-codex", environmentId: "local", caseId: "cloud-onboarding",
    provider: "codex", model: "synthetic-model", runtimeMode: "native", status: "failed", error: "onboarding_work_before_acceptance", cleanup: "passed", attempt: 1,
    startedAt: "2026-01-01T00:00:00Z", finishedAt: "2026-01-01T00:00:01Z", durationMs: 1000,
    productJourney: { outcome: "failed", startingState: "onboarding", phases: [{ phase: "journey", outcome: "failed", code: "onboarding_work_before_acceptance" }],
      checks: [], privacy: "private", resourceDisposition: "retained" } };
}
function preAcceptanceReceipt(): OnboardingPreAcceptanceEvidence {
  return { version: 1, checkpoint: "awaiting-proposal", violations: ["attachment_present"],
    taskCount: 1, attachmentCount: 1, documentCount: 0, nonPlanningDocumentCount: 0,
    firstTaskMatchesCanonicalParent: true, firstTaskStatus: "in_review", canonicalParentStatus: "in_review" };
}
describe("onboarding pre-acceptance retained evidence", () => {
  it("accepts historical results without pre-acceptance evidence and preserves optional receipts in reports", () => {
    const retained = result();
    expect(() => validateRetainedRunnerResult(retained)).not.toThrow();
    expect(renderCaseOutcome(retained, true, [])).not.toContain("Onboarding pre-acceptance evidence");
    Object.assign(retained.productJourney!, { onboardingPreAcceptance: preAcceptanceReceipt() });
    const roundTrip = JSON.parse(JSON.stringify(retained));
    expect(() => validateRetainedRunnerResult(roundTrip)).not.toThrow();
    const output = renderCaseOutcome(roundTrip, true, []);
    for (const text of ["Onboarding pre-acceptance evidence", "awaiting-proposal", "attachment_present", "First task status", "Canonical parent status", "in_review", "Attachments", "Non-planning documents", "onboarding_work_before_acceptance"]) expect(output).toContain(text);
    expect(roundTrip.status).toBe("failed");
    expect(roundTrip.productJourney.outcome).toBe("failed");
  });
  it.each([
    ["raw bodies", () => ({ ...preAcceptanceReceipt(), body: "private-body-must-not-render" })],
    ["task identifiers", () => ({ ...preAcceptanceReceipt(), taskIds: ["private-task"] })],
    ["document keys", () => ({ ...preAcceptanceReceipt(), documentKeys: ["private-key"] })],
    ["unknown version", () => ({ ...preAcceptanceReceipt(), version: 2 })],
    ["unknown checkpoint", () => ({ ...preAcceptanceReceipt(), checkpoint: "private text" })],
    ["unknown violation", () => ({ ...preAcceptanceReceipt(), violations: ["private text"] })],
    ["duplicate violations", () => ({ ...preAcceptanceReceipt(), violations: ["attachment_present", "attachment_present"] })],
    ["empty violations", () => ({ ...preAcceptanceReceipt(), violations: [] })],
    ["inconsistent violations", () => ({ ...preAcceptanceReceipt(), violations: ["first_task_done"] })],
    ["negative counts", () => ({ ...preAcceptanceReceipt(), attachmentCount: -1 })],
    ["fractional counts", () => ({ ...preAcceptanceReceipt(), taskCount: 1.5 })],
    ["unsafe counts", () => ({ ...preAcceptanceReceipt(), documentCount: Number.MAX_SAFE_INTEGER + 1 })],
    ["invalid document counts", () => ({ ...preAcceptanceReceipt(), nonPlanningDocumentCount: 1 })],
    ["raw task status", () => ({ ...preAcceptanceReceipt(), firstTaskStatus: "private status" })],
    ["raw parent status", () => ({ ...preAcceptanceReceipt(), canonicalParentStatus: "private status" })],
    ["nonboolean match", () => ({ ...preAcceptanceReceipt(), firstTaskMatchesCanonicalParent: "true" })],
    ["inconsistent task match", () => ({ ...preAcceptanceReceipt(), firstTaskMatchesCanonicalParent: false })],
    ["inconsistent matched statuses", () => ({ ...preAcceptanceReceipt(), canonicalParentStatus: "done" })],
    ["missing fields", () => ({ version: 1 })],
    ["null", () => null],
  ] as const)("rejects pre-acceptance evidence containing %s", (_label, makeReceipt) => {
    const retained = result();
    Object.assign(retained.productJourney!, { onboardingPreAcceptance: makeReceipt() });
    expect(() => validateRetainedRunnerResult(retained)).toThrow("result.productJourney.onboardingPreAcceptance");
  });
  it("renders a fixed fallback for malformed pre-acceptance evidence without exposing its fields", () => {
    const retained = result();
    Object.assign(retained.productJourney!, { onboardingPreAcceptance: { ...preAcceptanceReceipt(), body: "private-body-must-not-render" } });
    const output = renderCaseOutcome(retained, false, []);
    expect(output).toContain("Onboarding pre-acceptance evidence unavailable: invalid receipt");
    expect(output).not.toContain("private-body-must-not-render");
    expect(output).not.toContain("attachment_present");
  });
});
