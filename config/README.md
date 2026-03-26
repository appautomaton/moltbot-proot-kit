# Configuration (repo-local)

Paths below are relative to the repo root.

## What this directory is for

This repo runs OpenClaw as a standalone service with:

- **Repo-local secrets**: `config/.env` (gitignored)
- **Repo-local, commit-safe config**: `config/openclaw/**/*.json5` (no secrets)
- **Repo-local state**: `bots/` (sessions, logs, credentials, workspaces; mostly gitignored)

The goal is to keep *behavior/config* reviewable in git while keeping *secrets/state* local.

## How OpenClaw actually loads config

- Secrets/env: `config/.env` (loaded by `scripts/openclaw.mjs` before running OpenClaw)
- State dir: `$OPENCLAW_STATE_DIR` (this repo typically pins it to `bots/` via `config/.env`)
- Active config file: `bots/openclaw.json` (default: `$OPENCLAW_STATE_DIR/openclaw.json`; in this repo `OPENCLAW_STATE_DIR` is usually `bots`)
- Modular config root: `config/openclaw/openclaw.json5` (included from `bots/openclaw.json` via `$include`)

### Diagram

`pnpm openclaw <cmd>`
→ `scripts/openclaw.mjs` loads `config/.env` (does not override already-set env vars)
→ resolves repo-relative paths like `OPENCLAW_STATE_DIR=bots`
→ OpenClaw reads `$OPENCLAW_STATE_DIR/openclaw.json`
→ `$include` pulls in `config/openclaw/openclaw.json5`
→ config supports `${ENV_VAR}` substitution (env must be set and non-empty)

Confirm the active config path any time:

```bash
pnpm openclaw models status
```

## Layout

```
config/
  .env                       # local secrets (gitignored)
  .env.template              # secret template
  openclaw.template.json     # optional thin include template (no secrets)
  openclaw/
    openclaw.json5           # include-only root wiring
    agents/
      index.json5            # agent list orchestrator
      defaults.json5         # shared agent defaults
      list/
        coder-cli.json5
        gemini.json5
        main.json5
        sandbox-moltbook.json5
        writer.json5
    auth.json5               # feature fragments ↓
    bindings.json5
    browser.json5
    channels.json5
    commands.json5
    canvas-host.json5
    gateway.json5
    hooks.json5
    messages.json5
    meta.json5
    models.json5
    plugins.json5
    session.json5
    skills.json5
    tools.json5
    ui.json5
    wizard.json5
```

## Editing rules

- Never commit secrets inside `config/openclaw/**/*.json5` (or anywhere in git).
- Put secrets in `config/.env` and reference them from JSON5 via `${ENV_VAR}` (missing/empty env vars will fail config load).
- Keep `bots/openclaw.json` as a thin `$include` entrypoint so config stays modular.
- Treat `config/openclaw/openclaw.json5` as wiring only; make substantive config edits in the fragment files.
- Avoid commands that write config back to disk if you want to preserve the `$include` structure (some commands rewrite to a single flattened JSON file).
- `agents.list.main` is intentionally workspace-only for filesystem edits; use a specialist coding agent or broader policy change for repo-wide edits.
