# Tool access boundaries

Baseline: `efc2ddc7bf19ec319b21cd294e71e5a4932c16f4`.
`server/src/services/tool-access.ts` has 21,525 lines and 829,519 bytes.
Imports account for 293 lines. The service factory spans 18,366 lines,
including its public method implementations and service wiring.
The largest functions are connection setup (1,468 lines), OAuth callback
completion (644), OAuth start (613), and grant refresh (611).

The first batch contains three dependent PRs. Each PR targets its predecessor.
Existing exports remain compatible. No branch is merged as part of this batch.

| Order | Responsibility and destination | Estimated move / net reduction | Contract | State and effects | Verification |
| --- | --- | --- | --- | --- | --- |
| 1 | GitHub access discovery, `services/tool-access/github-access-discovery.ts` | 290 / 288 lines | Token or headers and request function to normalized repository/account metadata | GitHub pagination and response validation; no stored grants or shared state | Existing public exports, paginated PAT and managed access, malformed responses, retry classification, GitHub service integration |
| 2 | Connection method configuration and projection, `services/tool-access/connection-methods.ts` | About 330 / 310 lines | Reviewed method and raw settings to validated settings; connection settings and tool input to projected headers/schema/arguments | Pure transforms; provider-specific argument policy stays in its existing module | Configuration rejection, managed defaults, header safety, legacy methods, setup and discovery integration |
| 3 | OAuth protocol handling, `services/tool-access/oauth/` | About 1,500 / 1,400 lines | Guarded requests and connection metadata to discovered endpoints; registration request to validated client material | Network interpretation and endpoint policy; persistence and refresh leases stay in the coordinator | Existing discovery, DCR, CIMD, scope, redaction, issuer and endpoint-security tests; real local protocol fixture |
| 4 | Profile resolution and review, `services/tool-access/profiles/` | About 1,500 / 1,400 lines | Company, agent, selectors and current catalog to effective profiles and review decisions | Scoped queries and profile mutations; preserve assignment locks and caller transactions | Binding precedence, exclusions, company isolation, new-tool review and lightweight projections |
| 5 | Connection token brokering, `services/tool-access/token-broker/` | About 1,400 / 1,300 lines | Authorized run and token request to issuance result | Run/membership locks, rate limit, credential exchange, hashed issuance audit | Revocation races, scope restriction, unavailable/disabled broker, exchange failure and secret redaction |

Rows 4 and 5 are follow-up candidates, not part of the initial batch. Reassess
their contracts after the first three cuts. Keep authorization, current grant
checks, company isolation, audit, and transaction ownership with their existing
owners. Do not pass the full service context into a new module.

Existing extracted owners include tool-access policy, profile entry validation,
binding precedence, credential bindings, MCP transport and endpoint guards,
runtime supervision, managed Cloud connectors, Vercel Connect, and individual
provider policies. New modules import those owners directly and never import
the compatibility service entry point.

Run relevant tests before and after each move, with one database test worker.
Compare moved bodies against the base. Run repository typecheck, full tests,
and build at the batch handoff. Record setup failures separately from behavior
failures, and leave unavailable checks unverified.

## First extraction

GitHub access discovery preserves all six moved function bodies exactly.
The service retains grant selection, credential resolution, refresh retry,
membership locking, revision checks, persistence, and webhook updates.
The original service becomes 21,237 lines / 820,116 bytes; the new module is
294 lines / 9,722 bytes. Public-path tests pass before and after: 13 focused
tests and 11 selected GitHub service cases using disposable PostgreSQL.
The initial test attempt could not resolve the unbuilt plugin SDK; building
the existing workspace prerequisites resolved that setup failure.

## Second extraction

Connection method selection, settings validation, and header/schema/argument
projection now live in `tool-access/connection-methods.ts`. Inputs use a small
settings shape with required config and transport, independent of database rows.
The service and gateway retain their existing entry points. Provider policies
remain in the Honcho, Google Chat, and Gmail modules and are called in the same
order. No configuration snapshots or caches are added.

All 11 moved function bodies and the private record parser match the baseline.
The original service becomes 20,917 lines / 808,777 bytes; the new module is
359 lines / 12,665 bytes. The full service suite (466 cases) and provider-policy
coverage pass before and after; the combined post-move run passes 506 tests.
Server TypeScript checking passes. The first typecheck exposed that the public
ToolConnection DTO allows absent config; the module now declares the required
validated settings shape directly instead of adding internal fallback checks.
