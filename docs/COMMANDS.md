# OpenClaw Commands Reference (Repo Wrapper)

This repo runs OpenClaw through the wrapper in `scripts/openclaw.mjs`.

## Canonical entrypoint (repo root)

```bash
pnpm openclaw <command> [subcommand] [options]
```

Run commands from the repo root (the directory with this repo's `package.json`).

## Wrapper scripts in this repo (authoritative)

```bash
pnpm openclaw:install      # Install dependencies in openclaw/
pnpm openclaw:ui:build     # Build Control UI into openclaw/dist/control-ui
pnpm openclaw:build        # Build CLI/backend into openclaw/dist
pnpm docs:check            # Validate onboarding docs against repo truth
```

In non-interactive shells, use:

```bash
CI=true pnpm openclaw:install
```

## Core CLI commands (via wrapper)

```bash
pnpm openclaw --help
pnpm openclaw <command> --help

pnpm openclaw models status
pnpm openclaw gateway
pnpm openclaw gateway status
pnpm openclaw gateway stop
pnpm openclaw gateway --port 18789
pnpm openclaw gateway --force

pnpm openclaw agents list --bindings
pnpm openclaw channels status --probe
pnpm openclaw hooks list
pnpm openclaw nodes status
pnpm openclaw status
pnpm openclaw health
pnpm openclaw logs
```

## Messaging and channel examples

```bash
pnpm openclaw message send --target +15555550123 --message "Hi"
pnpm openclaw message send --channel telegram --target @mychat --message "Hi"
pnpm openclaw channels login --verbose
pnpm openclaw sessions
```

## Setup and configuration helpers

```bash
pnpm openclaw setup
pnpm openclaw setup --mode local --non-interactive
pnpm openclaw onboard
pnpm openclaw configure
pnpm openclaw config
```

## State and profile notes (important)

For this wrapper repo, the default workflow is repo-local state:

- `OPENCLAW_STATE_DIR=bots` (typically set in `config/.env`)
- Source config root: `config/openclaw/openclaw.json5`
- Generated runtime config: `bots/.runtime/openclaw.runtime.json5`
- `bots/openclaw.json` remains the tracked compatibility entrypoint, but the wrapper renders the actual runtime config file before launch.

Upstream OpenClaw profile behavior (context only):

- Default profile (if state dir is not overridden): `~/.openclaw/`
- `--dev`: `~/.openclaw-dev/`
- `--profile <name>`: `~/.openclaw-<name>/`

Do not assume home-directory profiles for this repo unless you intentionally override `OPENCLAW_STATE_DIR`.

Docs: https://docs.openclaw.ai/cli
