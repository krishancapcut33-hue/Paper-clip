import { describe, expect, it } from "vitest";
import { caseReadPageSchema, projectAgentCaseRead } from "./case-agent-read.js";

const detail = { id: "case", companyId: "company", workIssueId: "task", phase: "verification", handoffVersion: 4,
  updatedAt: "2026-10-20T00:00:00Z", fields: { total: 6 }, workIssue: { id: "task", status: "in_progress", statusVersion: 7 } };

describe("bounded authorized case read projection", () => {
  it("keeps small cases structured and preserves routing on every large JSON page", () => {
    expect(projectAgentCaseRead(detail, {})).toMatchObject({ fields: { total: 6 }, handoffVersion: 4, workIssue: { statusVersion: 7 }, readPage: { mode: "inline" } });
    const large = { ...detail, summary: "\n\"\\🧾".repeat(8_000), fields: { ["large-key-".repeat(2_000)]: ["\n\"\\🧾".repeat(9_000), { exact: true }] },
      documentRefs: Array.from({ length: 1_000 }, (_, i) => ({ title: `Document ${i}` })) };
    for (const section of ["case", "fields"] as const) {
      let result = projectAgentCaseRead(large, { section, limitBytes: 8192 });
      let text = "";
      for (let pages = 0; ; pages++) {
        expect(pages).toBeLessThan(100);
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(24 * 1024);
        expect(result).toMatchObject({ id: detail.id, handoffVersion: 4, phase: "verification", workIssue: { statusVersion: 7 } });
        if (result.readPage.mode !== "json_text") throw new Error("Expected a JSON page");
        text += result.readPage.text;
        if (result.readPage.nextOffsetBytes === null) break;
        result = projectAgentCaseRead(large, { section, limitBytes: 8192, offsetBytes: result.readPage.nextOffsetBytes, snapshot: result.readPage.snapshot });
      }
      expect(JSON.parse(text)).toEqual(section === "case" ? large : large.fields);
    }
  });

  it("rejects mixed snapshots after data or task routing changes", () => {
    const first = projectAgentCaseRead(detail, { section: "fields", limitBytes: 4 });
    const options = { section: "fields", offsetBytes: 4, snapshot: first.readPage.snapshot };
    for (const changed of [{ ...detail, fields: { total: 8 } }, { ...detail, handoffVersion: 5 },
      { ...detail, workIssue: { ...detail.workIssue, statusVersion: 8 } }]) {
      expect(() => projectAgentCaseRead(changed, options)).toThrow("Case changed");
    }
  });

  it("validates continuation bounds and UTF-8 offsets without losing exact characters", () => {
    for (const input of [{ offsetBytes: 1 }, { limitBytes: 8193 }, { limitBytes: 3 }, { snapshot: "forged" }, { section: "secrets" }]) {
      expect(caseReadPageSchema.safeParse(input).success).toBe(false);
    }
    const value = { ...detail, fields: { value: "🧾" } };
    const first = projectAgentCaseRead(value, { section: "fields" });
    const bytes = Buffer.from(JSON.stringify(value.fields));
    const offset = bytes.indexOf(Buffer.from("🧾")) + 1;
    expect(() => projectAgentCaseRead(value, { section: "fields", offsetBytes: offset, snapshot: first.readPage.snapshot })).toThrow("UTF-8 byte offset");
  });
});
