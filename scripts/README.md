# `scripts/`

Repo-local wrappers for running OpenClaw in this monorepo setup.

## `openclaw.mjs`

`pnpm openclaw <command>` → `scripts/openclaw.mjs` → `pnpm --dir openclaw openclaw ...`

Behaviors:

- Loads `config/.env` into the child process env (does **not** override already-set vars).
- Normalizes repo-relative path env vars (e.g. `OPENCLAW_STATE_DIR=bots` → absolute path from repo root).
- Expands `~` to home directory in path env vars.
- Maps legacy env var names to current ones before launch (`CLAWDBOT_STATE_DIR` → `OPENCLAW_STATE_DIR`, `CLAWDBOT_CONFIG_PATH` → `OPENCLAW_CONFIG_PATH`, `GATEWAY_AUTH_TOKEN` → `OPENCLAW_GATEWAY_TOKEN`) without passing `CLAWDBOT_*` aliases down to OpenClaw.
- Rejects OpenClaw path env vars that resolve outside this repo unless `OPENCLAW_MONOREPO_ALLOW_EXTERNAL_PATHS=1` is set.
- Renders the modular source config under `config/openclaw/` into a reusable runtime file at `$OPENCLAW_STATE_DIR/.runtime/openclaw.runtime.json5` and points OpenClaw at that generated file.
- Normalizes `--dev` flag position (moves it to the start of the arg list). `--dev` and `--profile <name>` still inherit the wrapper-provided repo-local state/config paths.

## `browser-service.sh`

Starts the browser control sidecar (for environments needing a predictable browser/Xvfb setup, e.g. proot).

By default, browser user data and sidecar pid/log files live under
`$OPENCLAW_STATE_DIR/browser/` (`bots/browser/` in this repo). Override with
`BROWSER_USER_DATA_DIR` or `BROWSER_STATE_DIR` only when you intentionally want a
different location; external paths require `OPENCLAW_MONOREPO_ALLOW_EXTERNAL_PATHS=1`.
