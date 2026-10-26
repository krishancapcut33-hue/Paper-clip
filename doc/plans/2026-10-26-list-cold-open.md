# Task list and inbox cold opens

## Outcome and ownership

Cold-open `/issues` and `/inbox/*` should show useful, correctly ordered rows
without inserting earlier rows or changing row geometry as supporting data arrives.
This work owns the collection read contracts, their UI consumers, and navigation
badge reads. Keep issue authorization, mutation semantics, archive/undo, and
existing grouping/filter preferences with their current owners. The separate
staging performance effort (PR #17745) owns runner event-loop stalls.

Branch: `codex/list-cold-open`, based on `49bd7a4ba6`.
Endpoint: tested, reviewable PR with checks and review resolved; local test drive.
No staging infrastructure changes are needed for this implementation.

## Evidence and acceptance

Baseline on staging, authenticated browser with HTTP cache retained and fresh
application state: task rows ~4.5s; Mine task rows ~6.3s. Mine downloaded four
overlapping issue responses (500, 167, 52, 52 rows; 2,388,103 decoded bytes).
A failed-run row appeared at y=183 before tasks arrived, then moved to y=415.
These are individual observations, not percentile benchmarks.

| Journey | Required result | Evidence |
| --- | --- | --- |
| Cold Tasks / Mine | Bounded initial data; final row order before reveal; metadata fills stable slots | Request sizes, delayed-response browser trace, row geometry |
| Other inbox tabs and saved filters/grouping/nesting | Correct membership/order before paging, no false empty state | Focused contract/component tests plus local browser |
| More results and detail/back | No lost or duplicated rows; reading position preserved | Browser walkthrough and paging regressions |
| Archive/undo/read and background activity | Existing optimistic behavior survives; observed rows stay put | Existing regression suites and browser |
| Slow/failed metadata or list read | Stable layout; useful retry/error; no misleading partial inbox | Deferred request component tests and browser |
| Company/account boundaries | No cross-company or private-row leaks in lists or badges | Authorization tests |

## Implementation sequence

1. Remove full-list badge reads; preserve personal unread/archive/dismissal semantics.
2. Add a lean ordering index using existing pagination/filter contracts, then enrich
   only visible rows (at most 50). Batch hierarchy reads rather than fetching full
   task bodies per parent. Mine selects its most recent 100 rows server-side;
   existing client grouping/filtering remains in place. This is not a new global
   server-side pagination model for every saved view.
3. Commit inbox source data together rather than revealing unrelated responses in arrival order.
4. Match skeleton and row geometry. Enrichment cannot replace index membership,
   sorting fields, or row geometry; retain the existing inbox order pin.
5. Preload the requested collection module during access/company checks and stop
   downloading task detail code eagerly on collection opens.
6. Verify in the existing isolated local app, run required checks, prepare PR and resolve review.

Use targeted tests while iterating; full repository verification before PR-ready handoff.
Do not infer deployed speedup from local measurements or combine the separate server fix's savings.

## State

Implemented the bounded index, visible-row enrichment, compact badge reads, and
initial snapshot barrier. Legacy task lists retain their existing compact data.
Index and row requests retain ETags and in-flight coalescing but skip the short
server response TTL, so an archive undo immediately reads the changed state.

Local browser proof uses 160 seeded tasks, nested rows, long titles, unread
activity, and a saved recovery action. On desktop, the first Tasks placeholder
and task both start at y=163 with height 44. The equivalent inbox values are
y=175 and height 44. Delayed row enrichment produced zero position, height, or
title-width change across 12 measured rows on each page. Narrow-screen review
at 390 by 844 confirmed truncation and a compact recovery indicator.

Three fresh document loads with retained HTTP cache and a warm local Vite server
showed Tasks in 1.498–2.434s and Mine in 1.264–1.690s. These include browser-control
overhead while the test suite ran on the same computer. They are not comparable
to staging latency. For the same 100 local tasks, the old compact response was
262,441 decoded bytes and the index was 110,909 bytes, with no descriptions.

Workspace typecheck, production build, token gates, map validation, and focused
UI/server regressions passed. The full test run and final PR checks are pending.
Browser evidence is retained in the chat's `list-cold-open-test-drive` artifact
directory. Existing task-detail PR #17593 is already merged and verified on
staging; its paused hourly monitor is not part of this change.
