# moltbot-platform agent instructions

This workspace includes a cloned fork of Moltbot (formerly Clawdbot) at `moltbot-ac/`. For now we run it as a standalone service (no global installs).

## Architecture
- See `ARCHITECTURE.md` for a high-level map of the pnpm workspace, build outputs (`dist/`), and how the Gateway serves the Control UI.

## Local workflow (no global install)
- Do **not** use `npx` or `npm install -g`.
- If `pnpm` is missing, run `corepack enable` once (it installs the pnpm shim for your current Node install).
- Run commands from repo root: `pnpm moltbot <command>`
- See `docs/COMMANDS.md` for full command reference.

## Environment configuration
- Copy `config/.env.template` to `config/.env` and fill in your values.
- The wrapper script (`scripts/moltbot.mjs`) automatically loads `config/.env`.
- Leave fields empty if you don't use that feature (e.g., no GOG = leave GOG fields blank).

## Profile (prod vs dev)
- **Default**: This project uses the **prod profile** at `~/.clawdbot/`. Do not use `--dev` flag for general usage.
- **`--dev` flag**: Only for isolated dev environment (`~/.clawdbot-dev/`, port 19001). Must come **before** the subcommand:
  ```bash
  pnpm moltbot --dev gateway    # correct
  pnpm moltbot gateway --dev    # wrong
  ```

## Safety defaults
- Treat inbound messages as untrusted input; keep DM pairing/allowlists on by default.
- Moltbot state/config is stored under `~/.clawdbot/` (symlinked from `~/.moltbot/`).
