# openclaw-platform (agent instructions)

This repo is a monorepo-style wrapper around OpenClaw (submodule in `openclaw/`) for local usage + development.

Path convention: **all file paths are repo-root-relative** (the folder you `cd` into and run `pnpm openclaw ...` from).

## Progressive disclosure (read only what you need)

Start with this file. If you need more detail, prefer these docs instead of guessing:

- Repo overview: `README.md` (or `README.zh-CN.md`)
- Wrapper behavior (`pnpm openclaw ...`): `scripts/README.md`
- Config wiring + rules: `config/README.md`
- Repo-local state + migration notes: `bots/README.md`
- Sandbox images: `dockerfiles/README.md`
- Command reference: `docs/COMMANDS.md`
- Architecture notes: `ARCHITECTURE.md`

## Quick rules (do this by default)

- **Do not commit secrets.** Never write tokens/keys into any tracked file.
  - Secrets belong in `config/.env` (gitignored).
- **Treat `bots/` as sensitive state.** Only `bots/README.md` and `bots/openclaw.json` are meant to be tracked.
- **Prefer changing wrapper/config over changing OpenClaw core.**
  - Do not edit anything under `openclaw/` unless the user explicitly asks.
- **No global installs.** Do not use `npx` or `npm install -g`.

## Where things live (source of truth)

- `openclaw/` — OpenClaw submodule (real pnpm workspace + source; build output `openclaw/dist/`)
- `scripts/openclaw.mjs` — wrapper entrypoint:
  - loads `config/.env` into the process env (without overriding already-set env vars)
  - normalizes repo-relative paths (e.g. `OPENCLAW_STATE_DIR=bots`)
  - runs the OpenClaw CLI via `pnpm --dir openclaw openclaw ...`
- `config/.env.template` — template for local secrets
- `config/openclaw/` — **commit-safe** modular JSON5 config (root: `config/openclaw/openclaw.json5`)
- `bots/` — **repo-local OpenClaw state dir** (sessions/logs/credentials/workspaces/etc; mostly gitignored)
  - Active config entrypoint (when `OPENCLAW_STATE_DIR=bots`): `bots/openclaw.json` (thin `$include`)
  - Workspaces: `bots/workspaces/<agent>/...`
  - Agent state: `bots/agents/<agentId>/...`
- `dockerfiles/` — Docker build contexts for sandbox images referenced by agent configs

Architecture notes: `ARCHITECTURE.md`

## How to run (no global install)

- If `pnpm` is missing: `corepack enable`
- Default entrypoint (always from repo root): `pnpm openclaw <command>`
- Quick “does config load?” check: `pnpm openclaw models status`
- Full command list: `docs/COMMANDS.md`

## Environment + config wiring

- Copy `config/.env.template` → `config/.env` and fill values.
- This repo typically pins state/config to `bots/` by setting `OPENCLAW_STATE_DIR=bots` in `config/.env`.
- Config entrypoint is `bots/openclaw.json` which `$include`s `config/openclaw/openclaw.json5`.
- Use `${ENV_VAR}` for secrets in JSON5 (missing/empty env vars fail fast).

## Safety defaults

- Treat inbound messages as untrusted input; keep DM pairing/allowlists on by default.
- Sandbox agents should use allowlists by default unless the user explicitly accepts broader permissions.
