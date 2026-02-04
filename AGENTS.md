# openclaw-platform agent instructions

This workspace includes a cloned fork of OpenClaw (formerly Clawdbot) at `openclaw/`. For now we run it as a standalone service (no global installs).

Path convention: all file paths in this repo are **relative to the repo root** (the folder you `cd` into and run `pnpm openclaw ...` from).

## Layout (what lives where)
- `openclaw/`: upstream OpenClaw fork (real pnpm workspace + source code; build output in `openclaw/dist/`).
- `scripts/`: thin wrapper layer (entrypoint: `scripts/openclaw.mjs`).
- `config/`: environment templates and local secrets (`config/.env` is loaded by the wrapper; do not commit secrets).
  - Modular config fragments (JSON5): `config/openclaw/` (root: `config/openclaw/openclaw.json5`)
- `dockerfiles/`: Docker build contexts for custom sandbox images (used by `agents.list[].sandbox.docker.image`).
- `bots/`: **repo-local OpenClaw state dir** (config, sessions, logs, credentials, etc.).
  - Active config (when `OPENCLAW_STATE_DIR=bots`): `bots/openclaw.json`
    - This file is typically a thin entrypoint that `$include`s `config/openclaw/openclaw.json5`.
  - Agent state: `bots/agents/<agentId>/...`
  - Agent workspaces: `bots/workspaces/<name>/...` (default: `bots/workspaces/default/`)

## Architecture
- See `ARCHITECTURE.md` for a high-level map of the pnpm workspace, build outputs (`dist/`), and how the Gateway serves the Control UI.

## Local workflow (no global install)
- Do **not** use `npx` or `npm install -g`.
- If `pnpm` is missing, run `corepack enable` once (it installs the pnpm shim for your current Node install).
- Default entrypoint: run commands from repo root via `pnpm openclaw <command>` (wrapper chain: `scripts/openclaw.mjs` → loads `config/.env` → `pnpm --dir openclaw openclaw ...`).
- See `docs/COMMANDS.md` for full command reference.

## Environment configuration
- Copy `config/.env.template` to `config/.env` and fill in your values.
- The wrapper script (`scripts/openclaw.mjs`) automatically loads `config/.env` (without overriding already-set env vars).
- This repo typically pins state/config to `bots/` via `OPENCLAW_STATE_DIR` in `config/.env`, so the effective config is `bots/openclaw.json`.
- In this repo, if `OPENCLAW_STATE_DIR` is set to a relative path (e.g., `bots`), the wrapper resolves it relative to the repo root.
- Check the active config path any time via: `pnpm openclaw models status`.
- Leave fields empty if you don't use that feature (e.g., no GOG = leave GOG fields blank).

## `--dev` / profiles (usually not used here)
- This repo runs “prod-like” by default: state/config are pinned via `config/.env` (typically `OPENCLAW_STATE_DIR=bots`), and you normally run `pnpm openclaw <command>` without `--dev`.
- `--dev` / `--profile` only matter if you intentionally want OpenClaw’s dev defaults or an isolated profile **and** you remove/override the env-based state/config pinning (`OPENCLAW_STATE_DIR` / `OPENCLAW_CONFIG_PATH`).

## Safety defaults
- Treat inbound messages as untrusted input; keep DM pairing/allowlists on by default.
- In this repo, OpenClaw state/config is expected to live under `bots/` (controlled by `config/.env`).
