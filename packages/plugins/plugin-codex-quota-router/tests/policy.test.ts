import { describe, expect, it } from "vitest";
import type { AiConnectionRouterRequest } from "@paperclipai/plugin-sdk";
import { routeCodexConnection } from "../src/policy.js";

const NOW = Date.parse("2026-10-20T17:00:00.000Z");
const iso = (millis: number) => new Date(millis).toISOString();

function request(
  values: Array<{ remaining: number | null; resetHours?: number; allowed?: boolean | null; reached?: boolean; stale?: boolean }>,
  pinnedMemberId?: string,
): AiConnectionRouterRequest {
  const candidates: AiConnectionRouterRequest["candidates"] = values.map((value, index) => {
    const id = `20000000-0000-4000-8000-00000000000${index + 1}`;
    const connectionId = `00000000-0000-4000-8000-00000000000${index + 1}`;
    const grantId = `10000000-0000-4000-8000-00000000000${index + 1}`;
    return {
      member: {
        id,
        binding: { mode: "shared", provider: "openai", method: "subscription", connectionId, grantId },
        profile: { provider: "codex", model: "gpt-6-sol" },
      },
      runtimeConfig: { provider: "codex", model: "gpt-6-sol" },
      notes: [],
      usage: {
        connectionId,
        grantId,
        provider: "openai",
        method: "subscription",
        status: "ok",
        checkedAt: iso(NOW - (value.stale ? 180_000 : 10_000)),
        source: "codex_wham",
        planType: null,
        overage: null,
        limits: [
          {
            id: "codex.primary_window", label: "Codex", scope: null,
            windowDurationSeconds: 604_800, resetInterval: null,
            resetsAt: iso(NOW + (value.resetHours ?? 12) * 3_600_000),
            remainingPercent: value.remaining,
            usedPercent: value.remaining === null ? null : 100 - value.remaining,
            used: null, limit: null, remaining: null, unit: null,
            limitReached: value.reached ?? false, allowed: value.allowed === undefined ? true : value.allowed,
          },
          {
            id: "spend_control", label: "Spend control", scope: null,
            windowDurationSeconds: null, resetsAt: null, remainingPercent: null,
            usedPercent: null, used: null, limit: null, remaining: null,
            unit: null, limitReached: false, allowed: null,
          },
        ],
      },
    };
  });
  return {
    companyId: "company", agentId: "agent", taskKey: "task",
    pool: { id: "pool", companyId: "company", pluginKey: "router", revision: 1,
      name: "Codex", enabled: true, mode: "usage_aware", thresholdPercent: 90,
      members: candidates.map(({ member }) => member) },
    lastMemberId: null, cursorVersion: 0,
    memberOrder: candidates.map(({ member }) => member.id),
    ...(pinnedMemberId ? { pinnedMemberId } : {}),
    candidates, now: iso(NOW),
  };
}

describe("Codex quota router", () => {
  it("rotates to the other account when the current account reaches 10%", () => {
    const input = request([{ remaining: 10 }, { remaining: 55 }]);
    expect(routeCodexConnection(input)).toMatchObject({ kind: "selected", memberId: input.memberOrder[1] });
  });

  it("respects round-robin order while both have more than 10%", () => {
    const input = request([{ remaining: 60 }, { remaining: 70 }]);
    input.lastMemberId = input.memberOrder[0]!;
    expect(routeCodexConnection(input)).toMatchObject({ kind: "selected", memberId: input.memberOrder[1] });
  });

  it("waits until the five-hour boundary when both accounts are low and reset is far away", () => {
    const result = routeCodexConnection(request([
      { remaining: 8, resetHours: 8 }, { remaining: 7, resetHours: 9 },
    ]));
    expect(result).toMatchObject({ kind: "exhausted", retryAt: iso(NOW + 3 * 3_600_000 + 1_000) });
  });

  it("uses only a provider-admitted account with positive quota inside five hours", () => {
    const result = routeCodexConnection(request([
      { remaining: 5, resetHours: 4 }, { remaining: 9, resetHours: 3 },
    ]));
    expect(result).toMatchObject({ kind: "selected", memberId: request([{ remaining: 5 }, { remaining: 9 }]).memberOrder[1] });
  });

  it("stops at zero, on explicit denial, and when the usage observation is unknown", () => {
    const result = routeCodexConnection(request([
      { remaining: 0, resetHours: 2 },
      { remaining: 4, resetHours: 2, allowed: false },
      { remaining: null, resetHours: 2 },
    ]));
    expect(result.kind).toBe("exhausted");
  });

  it("treats an unknown provider admission as unavailable", () => {
    expect(routeCodexConnection(request([{ remaining: 80, allowed: null }])).kind).toBe("exhausted");
  });

  it("never switches an existing task away from its pinned account", () => {
    const result = routeCodexConnection(request([
      { remaining: 2, resetHours: 8 }, { remaining: 70 },
    ], "20000000-0000-4000-8000-000000000001"));
    expect(result.kind).toBe("exhausted");
  });

  it("rejects stale probes and spend-control blocks", () => {
    const input = request([{ remaining: 80, stale: true }, { remaining: 90 }]);
    input.candidates[1]!.usage!.limits[1]!.limitReached = true;
    expect(routeCodexConnection(input).kind).toBe("exhausted");
  });

  it("requires all limiting windows to reset within five hours", () => {
    const input = request([{ remaining: 9, resetHours: 2 }]);
    input.candidates[0]!.usage!.limits.push({
      ...input.candidates[0]!.usage!.limits[0]!, id: "codex.secondary_window",
      remainingPercent: 8, usedPercent: 92, resetsAt: iso(NOW + 20 * 3_600_000),
    });
    expect(routeCodexConnection(input).kind).toBe("exhausted");
  });
});
