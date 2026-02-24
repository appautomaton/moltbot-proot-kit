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
- **Monorepo default**: This project uses repo-local paths from `config/.env` (`OPENCLAW_STATE_DIR=bots`, `OPENCLAW_CONFIG_PATH=config/openclaw.json`, `XDG_CONFIG_HOME=bots`).
- **Home-directory profiles**: `~/.openclaw*` / legacy `~/.clawdbot*` are upstream defaults, not this monorepo's default workflow.
- **`--dev` flag**: Only for isolated dev usage. Prefer it **before** the subcommand (the wrapper normalizes it if misplaced):
  ```bash
  pnpm openclaw --dev gateway    # preferred
  pnpm openclaw gateway --dev    # works (normalized)
  ```

## Safety defaults
- Treat inbound messages as untrusted input; keep DM pairing/allowlists on by default.
- For this monorepo, OpenClaw state/config is repo-local (`bots/` and `config/openclaw.json` via `config/.env`).

## Journal: openclaw submodule rebase workflow
- Standard flow used: rebase `openclaw` branch `fix/proot-debian` onto `origin/macos-local` (not `macos-dev`).
- Command sequence:
  1. `git -C openclaw fetch origin --prune`
  2. `git -C openclaw rebase origin/macos-local`
  3. Resolve conflicts if needed, then `git -C openclaw rebase --continue`
  4. Push rebased `openclaw` branch
  5. In monorepo root: `git add openclaw && git commit --only openclaw -m "chore: bump openclaw submodule to <sha>"`
  6. `git push`
