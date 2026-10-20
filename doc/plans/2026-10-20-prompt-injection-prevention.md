# Prompt Injection Prevention delivery

Branch: `codex/prompt-injection-prevention`. Base: `813e808af4`.
Endpoint: one reviewable PR; no shared-instance deployment.

The company opts in to a shared OpenRouter connection, defaulting to
`openai/gpt-oss-safeguard-20b`. Existing tool-result guards prefer a valid model
verdict, fall back to the original regex on classified dependency failures,
and preserve signing, return values, authorization and accounting.

| Acceptance | Required evidence | State |
| --- | --- | --- |
| Strict provider policy/parser, full redacted input, cancellation | Controlled HTTP tests and bounded live corpus | HTTP tests pass; six of nine corpus examples have correct live verdicts; three still rate-limited |
| Company settings, stale selections, permissions | Database/API tests | Passing |
| Budget admission, charges, recovery, retained holds | Database tests | Passing; final configuration-race check running |
| Existing six gateway boundaries and replay | Service integration tests | Six paths pass; virtual blocked-result HTTP mapping added for final verification |
| Connections always visible, draft/save/test | UI tests and isolated running app | Passing in isolated test-drive, including paid fixed-sample test |
| Documentation, maps, stories, required checks | Commands and PR evidence | Migration, tokens, maps, catalog, full typecheck/build passed; full tests and PR review pending |

The isolated test-drive uses a disposable company and the local board role.
Fast Responses was off for initial navigation and enabled to verify section order.
The shared OpenRouter connection was seeded through the normal API using an
authorized local key. All model requests used the official live OpenRouter
endpoint. Both fixed samples passed (0.99 and 0.80 seconds). A real gateway
echo returned the original benign diff and blocked the model-only instruction
override. Persisted classifier, cost, and gateway event rows were checked.
A deliberately invalid model exercised regex fallback, including an attack
beyond 4,000 characters. Disabling model use produced no classifier invocation.
GitHub write replay and delayed-provider cancellation use controlled fixtures.

Retained limitations: OpenRouter returned HTTP 429 on documentation, late-attack,
and large-diff corpus requests. Those attempts do not prove classifier accuracy.
The first test-drive PostgreSQL initialization failed; a standalone initdb probe
and a subsequent launch succeeded. The initial initialization cause is unresolved.
The running preview was not deployed to the shared development instance.

Next: finish full tests, rebase on current master, prepare the single PR, and
resolve CI/review findings. Use pinned pnpm 9.15.4; do not commit the lockfile.
