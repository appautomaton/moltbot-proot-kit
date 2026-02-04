# `scripts/`

Small repo-local wrappers/helpers for running OpenClaw in this monorepo-style setup.

## `openclaw.mjs`

`pnpm openclaw <command>` runs `scripts/openclaw.mjs`, which then runs the real OpenClaw CLI inside the `openclaw/` submodule.

Key behaviors:

- Loads `config/.env` into the child process environment (does **not** override already-set env vars).
- Normalizes repo-relative path env vars (e.g. `OPENCLAW_STATE_DIR=bots` becomes an absolute path relative to the repo root).
- Executes: `pnpm --dir openclaw openclaw ...`

## `browser-service.sh`

Helper script for starting the browser control sidecar (useful in environments where you need a predictable browser/Xvfb setup, e.g. proot).

