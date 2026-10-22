# Issue monitors

An issue monitor is a one-shot deferred action path for agent-owned issues in `in_progress` or `in_review`.

Use a monitor when the current assignee owns a future check against an async system or external service. Examples include Greptile review loops, GitHub checks, Vercel deployments, or provider jobs where the agent should come back later and decide what happens next.

Native runners in standard execution use `set_task_monitor({ taskId?, idempotencyKey, monitor })`. Omit `taskId` for the current task. An explicit target must be accessible, in the same company, assigned to the caller with no human assignee, and `in_progress` or `in_review`. Runtime-management permission still applies. Ask, planning, and review-only runs cannot use this tool. Generic `call_api` lifecycle restrictions remain in force.

To wait for a check:

1. Set a future `monitor.nextCheckAt` and short `monitor.notes` describing the check, with optional service context and bounds.
2. Confirm the receipt's persisted task ID, monitor state, next-check time, and bounds.
3. Call `paperclip_finish` with `reportedWorkDisposition: "yielded"` and `continuation: { kind: "monitor", summary, idempotencyKey }`. Report outstanding work honestly; the scheduled check may still block completion.
4. End the run. Paperclip keeps the task active, releases execution ownership, and the one-shot scheduler later wakes it with `issue_monitor_due`. This does not enqueue an immediate continuation. On resume, `get_task_context.activeTask.monitor` includes the consumed monitor’s notes and attempt count.

Only a valid persisted monitor on the current task authorizes that finish; scheduling another owned task does not. Authority is checked again under the final disposition lock. A timer that becomes due during an active native execution remains scheduled until execution releases it. Dispatch checks the current schedule, claim, status, and assignee so an older dispatch cannot clear a replacement monitor.

The service name `AI provider quota` is reserved for server-owned recovery of legacy runs. Native task monitors reject it; use ordinary service context and notes when scheduling a provider-usage check.

Use a new idempotency key to replace the schedule or clear it with `monitor: null`. Retrying the original call returns current monitor state without re-arming a consumed, replaced, or cleared timer. Monitor changes, audit activity, and mutation receipts are committed together, and unrelated execution/review policy is preserved. Legacy agents continue to use the issue API.

Monitor policy lives under `executionPolicy.monitor` and includes:

- `nextCheckAt`: when Paperclip should wake the assignee
- `notes`: non-secret instructions for what the assignee should check
- `serviceName`: optional non-secret external-service context
- `externalRef`: optional external-service reference input; Paperclip treats it as secret-adjacent, redacts it before persistence/visibility, and omits it from activity and wake payloads
- `timeoutAt`, `maxAttempts`, and `recoveryPolicy`: optional recovery hints for bounded waits

Monitors are not recurring intervals. When a monitor fires, Paperclip clears the scheduled monitor and queues an `issue_monitor_due` wake for the assignee. If the external service is still pending, the assignee must explicitly re-arm the monitor with a new `nextCheckAt`. If the issue moves to `done`, `cancelled`, an invalid status, or a human/unassigned owner, the monitor is cleared.

The task's waiting banner and composer countdown also display automatic retries
while their run is `scheduled_retry`. Once a retry is `queued` or `running`, its
retained `scheduledRetryAt` is historical and must not produce a waiting or overdue
warning. A separately scheduled monitor remains visible. Completed and cancelled
tasks hide both waiting surfaces even if a stale schedule remains in the response.

Because `serviceName` and `notes` remain visible in issue activity and wake context, operators should keep them short and non-secret. Put enough context for the assignee to know what to inspect, but do not include signed URLs, bearer tokens, customer secrets, tenant-private identifiers, or provider links with embedded credentials.

Monitor bounds are enforced. Paperclip rejects attempts to re-arm a monitor whose `timeoutAt` or `maxAttempts` is already exhausted. When a scheduled monitor reaches an exhausted bound at trigger time, Paperclip clears it and follows `recoveryPolicy`: `wake_owner` queues a bounded recovery wake for the assignee, `create_recovery_issue` opens visible issue-backed recovery work, and `escalate_to_board` records a board-visible escalation comment/activity.

Use `blocked` instead of a monitor when no Paperclip assignee owns a responsible polling path. In that case, name the external owner/action or create first-class recovery/blocker work.


New or changed monitor checks have a minimum delay of two hours. The server raises earlier requests to that time. This rule applies to the issue API and the native `set_task_monitor` tool. Read the saved `monitorNextCheckAt` from the response. Set `timeoutAt` later than the saved check time. The server rejects a timeout at or before the raised check time. Unchanged monitors keep their saved time.
