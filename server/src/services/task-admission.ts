import { randomUUID } from "node:crypto";
import { createWorkScheduler } from "./work-scheduler.js";

export type TaskDrainState = { startedAt: Date; expiresAt: Date | null; ownerId?: string };
let taskDrainState: TaskDrainState | null = null;
const drainDeadlines = createWorkScheduler();
const expiryListeners = new Set<() => void>();

export function onTaskDrainExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => { expiryListeners.delete(listener); };
}

export function readTaskDrain(now: Date): TaskDrainState | null {
  if (taskDrainState?.expiresAt && taskDrainState.expiresAt.getTime() <= now.getTime()) {
    taskDrainState = null;
    drainDeadlines.cancel("task-drain");
    for (const listener of expiryListeners) {
      try { listener(); } catch (error) { process.emitWarning(`Task drain expiry notification failed: ${String(error)}`); }
    }
  }
  return taskDrainState;
}

export function computeTaskDrain(opts: { ttlMs?: number | null; purpose?: "idle" } = {}): TaskDrainState {
  const startedAt = new Date();
  return { startedAt, expiresAt: opts.ttlMs == null ? null : new Date(startedAt.getTime() + opts.ttlMs),
    ...(opts.purpose === "idle" ? { ownerId: randomUUID() } : {}) };
}

export function applyTaskDrain(drain: TaskDrainState): void {
  taskDrainState = drain;
  drainDeadlines.cancel("task-drain");
  if (drain.expiresAt) drainDeadlines.schedule("task-drain", drain.expiresAt.getTime(), () => {
    readTaskDrain(new Date());
  });
}
export function startTaskDrain(opts: { ttlMs?: number | null; purpose?: "idle" } = {}): TaskDrainState {
  const drain = computeTaskDrain(opts);
  applyTaskDrain(drain);
  return drain;
}
export function stopTaskDrain(): { wasActive: boolean } {
  const wasActive = readTaskDrain(new Date()) !== null;
  taskDrainState = null;
  drainDeadlines.cancel("task-drain");
  return { wasActive };
}
export function isIdleTaskDrainActive(): boolean { return Boolean(readTaskDrain(new Date())?.ownerId); }

// Tokens count work until its actual promise settles, including after HTTP
// disconnects and after a cleanup batch has been removed from its input queue.
// The generation also catches work which starts AND finishes during a scan.
let generation = 0;
let active = 0;
export function beginIdleTrackedWork(): () => void {
  generation++;
  active++;
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    active--;
    generation++;
  };
}
export function trackIdleWork<T>(work: Promise<T>): Promise<T> {
  const finish = beginIdleTrackedWork();
  return work.finally(finish);
}
export function idleWorkSnapshot() { return { generation, active }; }
