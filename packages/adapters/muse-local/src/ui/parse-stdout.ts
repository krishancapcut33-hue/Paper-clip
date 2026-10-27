import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function parseMuseStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const stream = asRecord(parsed.stream);
  if (stream?.kind === "session" && stream.id) {
    return [{ kind: "system", ts, text: `session: ${stream.id}` }];
  }

  const payloadType = asString(parsed.payload_type).trim();
  const payload = asRecord(parsed.payload);

  if (payloadType === "run.terminal.completed" && payload?.text) {
    return [{ kind: "assistant", ts, text: asString(payload.text) }];
  }

  if (payloadType === "message" || payloadType === "assistant.message") {
    const text = asString(payload?.text || payload?.content);
    if (text) {
      return [{ kind: "assistant", ts, text }];
    }
  }

  if (payloadType === "tool_call" || payloadType === "tool.call") {
    const name = asString(payload?.name, "tool");
    return [{
      kind: "tool_call",
      ts,
      name,
      input: payload?.args ?? payload?.input ?? {},
      toolUseId: asString(payload?.id || payload?.call_id) || undefined,
    }];
  }

  if (payloadType === "tool_result" || payloadType === "tool.result") {
    return [{
      kind: "tool_result",
      ts,
      toolUseId: asString(payload?.id || payload?.call_id, "tool_result"),
      content: asString(payload?.result || payload?.content || payload?.output),
      isError: Boolean(payload?.is_error),
    }];
  }

  return [{ kind: "stdout", ts, text: line }];
}
