# OpenClaw Commands Reference

This project uses a local pnpm build. All commands are run via:

```bash
pnpm openclaw <command> <subcommand> [options]
```

Run from the repo root. The monorepo default is repo-local state/config via `config/.env`, not the upstream home-directory defaults.

---

## Build & Install

```bash
pnpm openclaw:install      # Install dependencies (uses copy import method for proot safety)
pnpm openclaw:ui:build     # Build the UI
pnpm openclaw:build        # Build the CLI
```

---

## Gateway

```bash
pnpm openclaw gateway                              # Run the wrapper-managed gateway
pnpm openclaw:gateway:restart                      # Restart the running wrapper-managed gateway
pnpm openclaw:gateway:restart -- --dev             # Restart the running dev gateway wrapper
pnpm openclaw:gateway:restart -- --profile qa      # Restart a named profile wrapper
pnpm openclaw gateway status                       # Check gateway status
pnpm openclaw gateway --port 18789                 # Run on custom port
pnpm openclaw gateway --force                      # Kill existing listener and start
```

Wrapper behavior for `pnpm openclaw gateway`:

- Watches `config/openclaw.json` through OpenClaw's native reload path.
- Watches `config/openclaw.d/*.json5` through the wrapper touch bridge.
- Watches `config/.env`; when it changes, the wrapper replaces the running gateway child with a new one built from the updated env.
- `pnpm openclaw:gateway:restart` signals the running wrapper to do the same controlled child replacement on demand.
- Set `OPENCLAW_INCLUDE_TOUCH_BRIDGE=0` to disable the fragment-touch bridge.

`pnpm openclaw:gateway:restart` is a wrapper command. It is intentionally separate from upstream `pnpm openclaw gateway restart`.

Dev profile commands (from project root):
```bash
pnpm openclaw --dev gateway                     # Run gateway in dev profile (default dev port 19001)
pnpm openclaw:gateway:restart -- --dev         # Restart the running dev wrapper
pnpm openclaw --dev gateway --bind lan          # Expose dev gateway on LAN
pnpm openclaw --dev gateway status              # Check dev gateway status
```

---

## Memory

```bash
pnpm openclaw memory status    # Show memory search index status
pnpm openclaw memory index     # Reindex memory files
pnpm openclaw memory search    # Search memory files
```

---

## Messaging

```bash
pnpm openclaw message send --target +15555550123 --message "Hi"
pnpm openclaw message send --channel telegram --target @mychat --message "Hi"
```

---

## Agent

```bash
pnpm openclaw agent --to +15555550123 --message "Run summary"
pnpm openclaw agent --to +15555550123 --message "Run summary" --deliver
pnpm openclaw agents         # Manage isolated agents
```

---

## Channels & Sessions

```bash
pnpm openclaw channels                   # Channel management
pnpm openclaw channels login --verbose   # Link WhatsApp Web (show QR)
pnpm openclaw sessions                   # List conversation sessions
```

---

## Skills

```bash
pnpm openclaw skills         # Skills management
```

---

## Health & Diagnostics

```bash
pnpm openclaw health         # Fetch health from running gateway
pnpm openclaw status         # Show channel health and recent sessions
pnpm openclaw doctor         # Health checks + quick fixes
pnpm openclaw logs           # Gateway logs
```

---

## Setup & Configuration

```bash
pnpm openclaw setup                              # Initialize config and workspace
pnpm openclaw setup --mode local --non-interactive
pnpm openclaw onboard                            # Interactive setup wizard
pnpm openclaw configure                          # Set up credentials/devices
pnpm openclaw config                             # Config helpers (get/set/unset)
```

---

## Browser

```bash
pnpm openclaw browser        # Manage dedicated browser (Chrome/Chromium)
```

---

## Other Utilities

```bash
pnpm openclaw dashboard      # Open Control UI
pnpm openclaw tui            # Terminal UI
pnpm openclaw plugins        # Plugin management
pnpm openclaw webhooks       # Webhook helpers
pnpm openclaw cron           # Cron scheduler
```

---

## Help

```bash
pnpm openclaw --help             # Show all commands
pnpm openclaw <command> --help   # Show help for specific command
```

---

## Notes

- **Monorepo default**: repo-local paths come from `config/.env`
- **Dev profile**: use `--dev`
- **Custom profile**: use `--profile <name>`

Docs: https://docs.openclaw.ai/cli
