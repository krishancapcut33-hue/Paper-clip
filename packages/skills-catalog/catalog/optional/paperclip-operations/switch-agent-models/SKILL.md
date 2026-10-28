---
name: switch-agent-models
description: >
  Repoint a company's agents at a different model in bulk: resolve what each
  agent actually accepts, plan without writing, apply with a snapshot, verify
  the responses, and roll back. Use when a quota runs out or a provider
  changes.
key: paperclipai/optional/paperclip-operations/switch-agent-models
recommendedForRoles:
  - general
  - manager
tags:
  - agents
  - models
  - providers
  - bulk-edit
  - rollback
requires:
  - python3
---

# Switch Agent Models

Move selected agents of one company onto a different model, prove the change landed, and keep a way back.

## When to use

- A provider quota is nearly spent and work must continue on another model.
- A new provider, gateway, or cheaper model should replace the current one.
- A model change went wrong and the previous values must be restored.

## When not to use

- One agent, one model, no verification needed: use the agent's settings page.
- The user only wants to know which model an agent runs: `list` is enough.
- The request is about prompts, budgets, or instructions: this skill changes one field.

## The rule that decides the value

An agent stores its model in `adapterConfig.model`. What that string must look like depends on one thing, and it is visible in the current value:

| Current model | How it resolves | Write |
| --- | --- | --- |
| starts with `paperclip/` | Paperclip projects a company AI connection into the agent's harness | `paperclip/<model id>` where the id is in a connection's model list |
| anything else | the agent's own provider resolves it — a local CLI config, a gateway alias, or a direct provider id | the exact string that provider accepts |

Two consequences:

- A gateway alias on a connection agent, or a raw provider id on a connection agent, writes successfully and fails on the next turn.
- The trailing `(max)`, `(high)`, `(medium)`, or `(low)` on some existing models is a reasoning hint. The script preserves the suffix the agent already has; pass `--drop-suffix` to remove it.

## Workflow

`$PAPERCLIP_API_URL` is required. `PAPERCLIP_COMPANY_ID` names the company unless `--company` is passed; `--company` accepts an id or a name. `PAPERCLIP_API_KEY` is optional in local-trusted installs and required otherwise.

```sh
# 0. which company, and what is configured today
python3 scripts/switch_models.py companies
python3 scripts/switch_models.py list

# 1. plan, no writes, with validation where a source exists
python3 scripts/switch_models.py plan --all \
  --model opencode-go-beam-free \
  --connection-model beam-free

# 2. apply, snapshot, then re-read every touched agent
python3 scripts/switch_models.py apply --select "GPU 执行,交付主管" \
  --model opencode-go-beam-free --connection-model beam-free --yes --verify

# 3. undo
python3 scripts/switch_models.py rollback \
  --snapshot ~/.paperclip/model-switch-snapshots/20261028T140000Z.json --yes
```

Selection accepts exact names, `re:<pattern>`, or `--all`.

`--model` is the literal value for agents that resolve through their provider. `--connection-model` is the id for agents whose current model starts with `paperclip/`; it is written with the prefix. Give both when the company has both kinds, or select each kind in its own run.

## Validation

Validation is best-effort and never invents a source:

| Agent kind | Checked against | If the source is missing |
| --- | --- | --- |
| connection | `GET /api/companies/{id}/ai-connections` model ids | reported as unverified |
| provider | `GET {gateway}/v1/models` when `--gateway-url` or `PAPERCLIP_GATEWAY_URL` is set | reported as unverified |

Unverified is not an error by default: many installs run CLI agents against a provider the server cannot see. `--force` skips a failed check; a failed check without `--force` blocks the write.

## Safety

- `plan` writes nothing and needs no confirmation.
- `apply` needs `--yes`; it saves every previous value to a snapshot before the first write, then compares each PATCH response to the requested model.
- Only `adapterConfig.model` changes. Status, budget, permissions, instructions, and connections stay as they are.
- Report the snapshot path and the rollback command with the result. A switch the user cannot undo is not a finished switch.

## Shape of the result

Report the table the script printed — agent, resolution kind, before, after, validation — plus the snapshot path. If a write failed, say which agent and which HTTP status; do not describe a partial switch as done.

Read [references/model-resolution.md](references/model-resolution.md) for the resolution rules and failure signatures, and [examples/](examples/) for two complete walkthroughs.
