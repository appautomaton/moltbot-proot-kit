# `scripts/`

Repo-local wrappers for running OpenClaw in this monorepo setup.

## `openclaw.mjs`

`pnpm openclaw <command>` → `scripts/openclaw.mjs` → `pnpm --dir openclaw openclaw ...`

Behaviors:

- Loads `config/.env` into the child process env (does **not** override already-set vars).
- Normalizes repo-relative path env vars (e.g. `OPENCLAW_STATE_DIR=bots` → absolute path from repo root).
- Expands `~` to home directory in path env vars.
- Maps legacy env var names to current ones (`CLAWDBOT_STATE_DIR` → `OPENCLAW_STATE_DIR`, `CLAWDBOT_CONFIG_PATH` → `OPENCLAW_CONFIG_PATH`, `GATEWAY_AUTH_TOKEN` → `OPENCLAW_GATEWAY_TOKEN`).
- Normalizes `--dev` flag position (moves it to the start of the arg list).

## `browser-service.sh`

Starts the browser control sidecar (for environments needing a predictable browser/Xvfb setup, e.g. proot).

