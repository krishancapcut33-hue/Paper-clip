import type { issues } from "@paperclipai/db";
import { prepareIssueMonitorUpdate } from "./issue-monitors.js";
import { describe, expect, it } from "vitest";
import { MONITOR_MIN_INTERVAL_MS, enforceMonitorMinimumInterval } from "./issue-execution-policy.js";

describe("enforceMonitorMinimumInterval", () => {
  const now = new Date("2026-10-16T10:00:00.000Z");
  const policy = (nextCheckAt: string) => ({ mode: "normal", monitor: { nextCheckAt, scheduledBy: "assignee" } });

  it("raises a new monitor that is sooner than the minimum", () => {
    const out = enforceMonitorMinimumInterval(policy("2026-10-16T10:05:00.000Z"), null, now);
    expect(Date.parse(out!.monitor!.nextCheckAt)).toBe(now.getTime() + MONITOR_MIN_INTERVAL_MS);
  });

  it("keeps a monitor that is already far enough out", () => {
    const p = policy("2026-10-16T13:00:00.000Z");
    expect(enforceMonitorMinimumInterval(p, null, now)).toBe(p);
  });

  it("does not move an unchanged monitor on an unrelated update", () => {
    const p = policy("2026-10-16T10:05:00.000Z");
    expect(enforceMonitorMinimumInterval(p, p, now)).toBe(p);
  });

  it("passes through a policy without a monitor", () => {
    expect(enforceMonitorMinimumInterval(null, null, now)).toBeNull();
    const p = { mode: "normal", monitor: null };
    expect(enforceMonitorMinimumInterval(p, null, now)).toBe(p);
  });
  it("rejects a timeout that expires before the raised check", () => {
    const p = { monitor: { nextCheckAt: "2026-10-16T10:05:00.000Z", timeoutAt: "2026-10-16T11:00:00.000Z" } };
    expect(() => enforceMonitorMinimumInterval(p, null, now)).toThrow("timeoutAt");
    p.monitor.timeoutAt = "2026-10-16T12:00:00.000Z";
    expect(() => enforceMonitorMinimumInterval(p, null, now)).toThrow("timeoutAt");
    p.monitor.timeoutAt = "2026-10-16T13:00:00.000Z";
    expect(enforceMonitorMinimumInterval(p, null, now).monitor.nextCheckAt).toBe("2026-10-16T12:00:00.000Z");
  });

  it("enforces the minimum on the native set_task_monitor preparation path", () => {
    const now = new Date();
    const early = new Date(now.getTime() + 5 * 60_000).toISOString();
    const earliest = new Date(now.getTime() + MONITOR_MIN_INTERVAL_MS);
    const timeout = new Date(now.getTime() + 3 * 60 * 60_000).toISOString();
    const issue = { status: "in_progress", assigneeAgentId: "agent", assigneeUserId: null, executionPolicy: null } as typeof issues.$inferSelect;
    const monitor = { nextCheckAt: early, notes: "Check external job", timeoutAt: timeout };
    const patch = prepareIssueMonitorUpdate(issue, monitor, { type: "agent", agentId: "agent", companyId: "company" }, now);
    expect(patch.monitorNextCheckAt).toEqual(earliest);
    expect(patch.executionPolicy).toMatchObject({ monitor: { nextCheckAt: earliest.toISOString(), timeoutAt: monitor.timeoutAt } });
    expect(() => prepareIssueMonitorUpdate(issue, { ...monitor, timeoutAt: new Date(now.getTime() + 60 * 60_000).toISOString() }, { type: "board", userId: "user" }, now)).toThrow("timeoutAt");
  });

});
