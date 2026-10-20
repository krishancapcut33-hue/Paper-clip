# Prompt Injection Prevention delivery

Branch: `codex/prompt-injection-prevention`. Rebased base: `1f3695ac67`.
Endpoint: one reviewable PR; no shared-instance deployment.

The company opts in to a shared OpenRouter connection, defaulting to
`openai/gpt-oss-safeguard-20b`. Existing tool-result guards prefer a valid model
verdict, fall back to the original regex on classified dependency failures,
and preserve signing, return values, authorization and accounting.

| Acceptance | Required evidence | State |
| --- | --- | --- |
| Strict provider policy/parser, full redacted input, cancellation | Controlled HTTP tests and bounded live corpus | HTTP tests pass; final policy produced three correct live corpus verdicts, six requests rate-limited |
| Company settings, stale selections, permissions | Database/API tests | Passing |
| Budget admission, charges, recovery, retained holds | Database tests | Twenty database/API tests pass, including configuration race and cancellation |
| Existing six gateway boundaries and replay | Service integration tests | All six paths pass; blocked virtual-result HTTP mapping verified |
| Connections always visible, draft/save/test | UI tests and isolated running app | UI journey passes; initial policy fixed samples passed, final policy live retries rate-limited |
| Documentation, maps, stories, required checks | Commands and PR evidence | Migration, tokens, maps, catalog, full typecheck/build passed; full tests and PR review pending. CI exposed missing OpenAPI coverage, now fixed and tested |

The isolated test-drive uses a disposable company and the local board role.
Fast Responses was off for initial navigation and enabled to verify section order.
The shared OpenRouter connection was seeded through the normal API using an
authorized local key. All model requests used the official live OpenRouter
endpoint. With the initial policy, both fixed samples passed (0.99 and 0.80 seconds). A real gateway
echo returned the original benign diff and blocked the model-only instruction
override. Persisted classifier, cost, and gateway event rows were checked.
A deliberately invalid model exercised regex fallback, including an attack
beyond 4,000 characters. Disabling model use produced no classifier invocation.
GitHub write replay and delayed-provider cancellation use controlled fixtures.

The final policy adds explicit definitions and labeled examples. Its bounded
live corpus pass correctly classified the quoted security test, prompt-disclosure
attack, and large benign diff; six other requests received HTTP 429.
The restarted app's fixed-sample retries also received HTTP 429, as did its two
gateway checks. Those gateway calls correctly fell back to regex, reproducing
the regex false positive on the benign diff and its miss on the model-only attack.
Those attempts do not prove final-policy classifier accuracy or successful
final-revision model integration. No incorrect live model verdict was observed.

Retained limitations: OpenRouter rate limits prevent complete final live proof.
The first test-drive PostgreSQL initialization and one later focused database
suite initialization failed; standalone initdb probes and subsequent launches
succeeded. The initialization causes remain unresolved.
The running preview was not deployed to the shared development instance.

PR: https://github.com/paperclipai/paperclip/pull/16976.
Next: finish full tests and resolve CI/review findings. Use pinned pnpm 9.15.4;
do not commit the lockfile. Keep final check and live evidence in the PR.
