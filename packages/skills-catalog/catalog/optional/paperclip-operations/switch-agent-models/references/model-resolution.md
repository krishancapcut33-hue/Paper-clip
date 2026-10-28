# How a Paperclip agent resolves its model

An agent stores one string in `adapterConfig.model`. Whether that string is a Paperclip model or a provider model is decided by its prefix, not by the adapter type.

## Connection-backed models

A value starting with `paperclip/` is projected by Paperclip: the company's AI connection supplies the provider, base URL, credential, and wire protocol, and the part after the prefix names a model inside that connection.

- Valid ids: `GET /api/companies/{companyId}/ai-connections` → `connections[].routing.models[].id`.
- A free model inside a connection usually has a bare id such as `beam-free`; the agent's value is `paperclip/beam-free`.
- If no connection lists the id, the run fails before the provider is contacted.
- The agent record does not name the connection. Validation therefore checks the union of the company's connection models; if two connections disagree, confirm the intended one in the UI before writing.

## Provider-resolved models

Anything else is passed to whatever the agent's harness uses: a local CLI's own configuration, a gateway alias, an OpenRouter-style id, or a direct provider id.

Examples of the same field holding different kinds of value:

| Agent | Value | Resolved by |
| --- | --- | --- |
| `paperclip_runner` | `paperclip/beam-free` | a Paperclip AI connection |
| `paperclip_runner` | `opencode-go-beam-free` | the local gateway that fronts the provider |
| `codex_local` | `gpt-5` | Codex's own configuration |
| `claude_local` | `claude-sonnet-4-5` | the Claude CLI's own configuration |

Paperclip cannot verify this value. If a gateway is configured (`--gateway-url`, `PAPERCLIP_GATEWAY_URL`), the script compares against its `/v1/models`; otherwise the plan reports `unverified` and leaves the judgement to the operator.

## Reasoning suffix

Some agents carry a trailing `(max)`, `(high)`, `(medium)`, or `(low)` on the model string. It is a reasoning-effort hint read by the harness, not part of the model id. The script preserves an existing suffix when the model changes and strips it from validation lookups. Pass `--drop-suffix` when the target provider would treat the suffix as part of the id.

## Failure signatures

- Written fine, fails on the next turn, model echoed back in the error: the value belongs to the other family.
- `422` answered in milliseconds: the gateway or server rejected the request locally. Read the body before changing models.
- `429` with `Retry-After`: rate limit or exhausted free tier. Another model may dodge it; changing models does not lift the limit on the same one.
- Agent stays idle after the switch: check the agent's lifecycle state and pause reason before suspecting the model.
