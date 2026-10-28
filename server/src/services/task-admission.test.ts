import { afterEach, describe, expect, it, vi } from "vitest";
import { onTaskDrainExpired, readTaskDrain, startTaskDrain, stopTaskDrain } from "./task-admission.js";

describe("task drain deadline", () => {
  afterEach(() => { stopTaskDrain(); vi.useRealTimers(); });

  it("releases admission once at its deadline without a status read or periodic sweep", async () => {
    vi.useFakeTimers();
    const resume = vi.fn();
    const unsubscribe = onTaskDrainExpired(resume);
    try {
      startTaskDrain({ ttlMs: 1000 });
      await vi.advanceTimersByTimeAsync(999);
      expect(resume).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(resume).toHaveBeenCalledTimes(1);
      expect(readTaskDrain(new Date())).toBeNull();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(resume).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally { unsubscribe(); }
  });

  it.each(["replace", "stop", "unsubscribe"] as const)("does not resume from an obsolete expiry after %s", async action => {
    vi.useFakeTimers();
    const resume = vi.fn();
    const unsubscribe = onTaskDrainExpired(resume);
    try {
      startTaskDrain({ ttlMs: 1000 });
      if (action === "replace") startTaskDrain({ ttlMs: null });
      if (action === "stop") stopTaskDrain();
      if (action === "unsubscribe") unsubscribe();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(resume).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { unsubscribe(); }
  });
});
