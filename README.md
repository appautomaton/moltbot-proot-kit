# openclaw-proot-kit

A local wrapper for running this fork of **OpenClaw** (formerly Clawdbot) as a **standalone Gateway service** on **Termux proot-distro Debian**, without `npx` and without `npm install -g`.

## Prerequisites

### Runtime Environment

This project is designed for [Termux](https://termux.dev/) with [proot-distro](https://github.com/termux/proot-distro) Debian:

```bash
proot-distro login --isolated debian
```

> It is recommended to set up a non-root user inside your proot environment.

### Node.js

Requires **Node 24+**. We recommend installing via [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 24
```

Then enable `pnpm` via corepack:

```bash
corepack enable
```

## Layout

- `openclaw/` — the cloned OpenClaw fork (git submodule)
- `config/` — environment configuration (`.env` for secrets)
- `docs/` — additional documentation
- `scripts/` — wrapper scripts

## Quickstart

```bash
# Clone with submodule
git clone --recurse-submodules https://github.com/appautomaton/openclaw-proot-kit.git
cd openclaw-proot-kit

# Install + build
pnpm openclaw:install
pnpm openclaw:ui:build
pnpm openclaw:build

# Set up repo-local environment
cp config/.env.template config/.env
# Edit config/.env with your API keys and secrets

# Start the gateway
pnpm openclaw gateway
```

## Common Commands

```bash
pnpm openclaw gateway                          # Run the wrapper-managed gateway
pnpm openclaw:gateway:restart                  # Restart the running wrapper-managed gateway
pnpm openclaw:gateway:restart -- --dev         # Restart the running dev gateway wrapper
pnpm openclaw gateway status                   # Check gateway status
pnpm openclaw sessions                         # List sessions
pnpm openclaw memory status                    # Memory index status
pnpm openclaw channels login                   # Link WhatsApp (show QR)
pnpm openclaw doctor                           # Health checks
```

See `docs/COMMANDS.md` for full reference.

## Gateway Wrapper Behavior

`pnpm openclaw gateway` runs a repo-local wrapper around the real OpenClaw gateway process.

- `config/openclaw.json` and `config/openclaw.d/*.json5` are applied automatically while the gateway is running.
- `config/.env` is also watched. When it changes, the wrapper replaces the running gateway child with a new one built from the updated env.
- `pnpm openclaw:gateway:restart` sends a restart signal to the running wrapper. This is separate from upstream `pnpm openclaw gateway restart`.

Profile-aware restart examples:

```bash
pnpm openclaw:gateway:restart
pnpm openclaw:gateway:restart -- --dev
pnpm openclaw:gateway:restart -- --profile qa
```

## Environment Variables

Copy `config/.env.template` to `config/.env` and fill in your values. The wrapper script (`scripts/openclaw.mjs`) loads this file automatically for repo-local runs. Leave fields empty if you don't use that feature.

Common overrides (optional):

```bash
# Keep agent workspaces under this repo (recommended; ignored by git)
AGENT_WORKSPACE=workspace

# Keep OpenClaw state under this repo (recommended; ignored by git)
OPENCLAW_STATE_DIR=bots

# Point OpenClaw at the repo config file
OPENCLAW_CONFIG_PATH=config/openclaw.json

# One-off example (override config path for a single command)
OPENCLAW_CONFIG_PATH="bots/openclaw.json" pnpm openclaw models status
```

Relative paths are resolved relative to the repo root by `scripts/openclaw.mjs`, so you can run `pnpm openclaw ...` from any CWD.

## Browser Automation (proot/headless-friendly)

If you want a stable "external browser service" (Xvfb + Chromium with CDP) for OpenClaw to attach to:

```bash
chmod +x scripts/browser-service.sh
scripts/browser-service.sh start
scripts/browser-service.sh status
```

Defaults: `DISPLAY=:99`, CDP port `18800`, user profile under `~/.openclaw/browser/clawd/user-data`.

## Notes

- **Monorepo default**: This repo uses repo-local paths from `config/.env`, typically `OPENCLAW_STATE_DIR=bots`, `OPENCLAW_CONFIG_PATH=config/openclaw.json`, and `XDG_CONFIG_HOME=bots`.
- **`--dev` flag**: For an isolated dev profile. Recommended: `pnpm openclaw --dev gateway` (the wrapper also accepts `pnpm openclaw gateway --dev` and normalizes it).
- **Manual wrapper restart**: `pnpm openclaw:gateway:restart` only works for gateways started by this repo wrapper. It does not start a new gateway if no wrapper is already running.
- **"node_modules missing" warning**: This is expected at the repo root. Ignore it or run commands with `pnpm --dir openclaw openclaw ...`.
