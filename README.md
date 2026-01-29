# moltbot-platform

This repo is a lightweight workspace for running a fork of **Moltbot** (formerly Clawdbot) as a **standalone Gateway service**, without `npx` and without `npm install -g`.

## Layout
- `moltbot-ac/` — the cloned Moltbot fork (actual source + pnpm workspace)
- `config/` — environment configuration (`.env` for secrets)
- `docs/` — additional documentation
- `scripts/` — wrapper scripts

## Quickstart

Prereqs: Node 22+ and `pnpm` available (use `corepack enable` once if needed).

```bash
# Install deps + build
pnpm moltbot:install
pnpm moltbot:ui:build
pnpm moltbot:build

# Set up environment variables
cp config/.env.template config/.env
# Edit config/.env with your API keys and secrets

# Initialize config/workspace
pnpm moltbot setup --mode local --non-interactive

# Start the Gateway
pnpm moltbot gateway
```

## Common Commands

```bash
pnpm moltbot gateway              # Run the gateway
pnpm moltbot gateway status       # Check gateway status
pnpm moltbot sessions             # List sessions
pnpm moltbot memory status        # Memory index status
pnpm moltbot channels login       # Link WhatsApp (show QR)
pnpm moltbot doctor               # Health checks
```

See `docs/COMMANDS.md` for full reference.

## Environment Variables

Copy `config/.env.template` to `config/.env` and fill in your values. The wrapper script (`scripts/moltbot.mjs`) automatically loads this file.

## Browser Automation (proot/headless-friendly)

If you want a stable "external browser service" (Xvfb + Chromium with CDP) for Moltbot to attach to:

```bash
chmod +x scripts/browser-service.sh
scripts/browser-service.sh start
scripts/browser-service.sh status
```

Defaults: `DISPLAY=:99`, CDP port `18800`, user profile under `~/.clawdbot/browser/clawd/user-data`.

## Notes

- **Profile**: This project uses the prod profile at `~/.clawdbot/` by default.
- **`--dev` flag**: Only use if you need an isolated dev environment (`~/.clawdbot-dev/`, port 19001). Must come before the subcommand: `pnpm moltbot --dev gateway`, not `pnpm moltbot gateway --dev`.
- **Corepack**: `corepack enable` is only needed if `pnpm` isn't on your PATH.
- **"node_modules missing" warning**: This is expected at the repo root. Ignore it or run commands with `pnpm --dir moltbot-ac moltbot ...`.
