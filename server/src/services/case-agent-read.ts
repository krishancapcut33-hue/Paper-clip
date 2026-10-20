import { createHash } from "node:crypto";
import { z } from "zod";
import { badRequest, conflict, unprocessable } from "../errors.js";

export const CASE_READ_PAGE_BYTES = 8 * 1024;
export const caseReadPageShape = {
  section: z.enum(["case", "fields"]).optional(),
  offsetBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  limitBytes: z.number().int().min(4).max(CASE_READ_PAGE_BYTES).optional(),
  snapshot: z.string().regex(/^[a-f0-9]{64}$/).optional(),
};
export const caseReadPageSchema = z.object(caseReadPageShape).strict().refine(
  input => !input.offsetBytes || !!input.snapshot,
  "A continuation offset requires the snapshot returned by the previous read",
);

type CaseDetail = Record<string, unknown> & {
  id: string; companyId: string; workIssueId: string | null; phase: string | null; handoffVersion: number;
  fields: Record<string, unknown>;
  workIssue: { id: string; status: string; statusVersion: number } | null;
};

/** Page only the already-authorized REST projection. No alternate permission or
 * saved-asset grant: every continuation reloads current accessible case data. */
export function projectAgentCaseRead(detail: CaseDetail, rawOptions: unknown) {
  const options = caseReadPageSchema.parse(rawOptions);
  const section = options.section ?? "case", offset = options.offsetBytes ?? 0;
  const limit = options.limitBytes ?? CASE_READ_PAGE_BYTES;
  const routing = { id: detail.id, companyId: detail.companyId, workIssueId: detail.workIssueId,
    phase: detail.phase, handoffVersion: detail.handoffVersion,
    workIssue: detail.workIssue ? { id: detail.workIssue.id, status: detail.workIssue.status, statusVersion: detail.workIssue.statusVersion } : null };
  const serialized = JSON.stringify(section === "fields" ? detail.fields : detail);
  const bytes = Buffer.from(serialized, "utf8");
  // Include routing and case revision even for a fields-only page. A changed
  // assignment/version cannot silently reuse an old fields continuation.
  const snapshot = createHash("sha256").update(JSON.stringify({ section, routing, updatedAt: detail.updatedAt })).update(serialized).digest("hex");
  if (options.snapshot && options.snapshot !== snapshot) throw conflict("Case changed; restart read_case at offset zero without snapshot");
  if (offset > bytes.length || (offset < bytes.length && (bytes[offset]! & 0xc0) === 0x80)) throw badRequest("Invalid case read UTF-8 byte offset");
  const explicitPage = Object.keys(options).length > 0;
  if (!explicitPage && bytes.length <= 16 * 1024) return { ...detail,
    readPage: { mode: "inline" as const, section, snapshot, offsetBytes: 0, nextOffsetBytes: null, totalBytes: bytes.length } };
  let end = Math.min(bytes.length, offset + limit);
  while (end < bytes.length && end > offset && (bytes[end]! & 0xc0) === 0x80) end--;
  const response = { ...routing, readPage: { mode: "json_text" as const, section, snapshot, offsetBytes: offset,
    nextOffsetBytes: end < bytes.length ? end : null, totalBytes: bytes.length,
    text: bytes.subarray(offset, end).toString("utf8") },
    guidance: "Join readPage.text pages to recover the exact selected JSON. Continue read_case with the same section and snapshot, and offsetBytes=nextOffsetBytes until null. A conflict requires restarting at zero without snapshot." };
  // Serialized JSON text may need escaping again in the result envelope.
  if (Buffer.byteLength(JSON.stringify(response)) > 20 * 1024) throw unprocessable("Case routing metadata exceeds the bounded read response");
  return response;
}
