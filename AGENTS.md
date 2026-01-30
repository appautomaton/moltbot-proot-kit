# openclaw-platform agent instructions

This workspace includes a cloned fork of OpenClaw (formerly Clawdbot) at `openclaw/`. For now we run it as a standalone service (no global installs).

## Architecture
- See `ARCHITECTURE.md` for a high-level map of the pnpm workspace, build outputs (`dist/`), and how the Gateway serves the Control UI.

## Local workflow (no global install)
- Do **not** use `npx` or `npm install -g`.
- If `pnpm` is missing, run `corepack enable` once (it installs the pnpm shim for your current Node install).
- Run commands from repo root: `pnpm openclaw <command>` (root wrapper: `node scripts/openclaw.mjs` → `pnpm --dir openclaw openclaw ...`)
- See `docs/COMMANDS.md` for full command reference.

## Environment configuration
- Copy `config/.env.template` to `config/.env` and fill in your values.
- The wrapper script (`scripts/openclaw.mjs`) automatically loads `config/.env` (without overriding already-set env vars).
- Leave fields empty if you don't use that feature (e.g., no GOG = leave GOG fields blank).

## Profile (prod vs dev)
- **Default**: This project uses the **prod profile** at `~/.openclaw/` (legacy `~/.clawdbot/` is still supported). Do not use `--dev` flag for general usage.
- **`--dev` flag**: Only for isolated dev environment (`~/.openclaw-dev/`, port 19001). Prefer it **before** the subcommand (the wrapper normalizes it if misplaced):
  ```bash
  pnpm openclaw --dev gateway    # preferred
  pnpm openclaw gateway --dev    # works (normalized)
  ```

## Safety defaults
- Treat inbound messages as untrusted input; keep DM pairing/allowlists on by default.
- OpenClaw state/config is stored under `~/.openclaw/` (legacy `~/.clawdbot/` is still supported).
