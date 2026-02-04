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
  .env
  .env.template
  openclaw.template.json   # optional thin include template (no secrets)
  openclaw/
    openclaw.json5         # root (JSON5), uses $include
    agents/
      index.json5
    *.json5                # feature fragments (models/channels/hooks/tools/...)
```

## Editing rules

- Never commit secrets inside `config/openclaw/**/*.json5` (or anywhere in git).
- Put secrets in `config/.env` and reference them from JSON5 via `${ENV_VAR}` (missing/empty env vars will fail config load).
- Keep `bots/openclaw.json` as a thin `$include` entrypoint so config stays modular.
- Avoid commands that write config back to disk if you want to preserve the `$include` structure (some commands rewrite to a single flattened JSON file).
