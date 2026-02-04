# OpenClaw Commands Reference

This project uses a local pnpm build. All commands are run via:

```bash
pnpm openclaw <command> <subcommand> [options]
```

Run from either `openclaw-platform/` or `openclaw/`. Uses prod profile at `~/.openclaw/` (legacy `~/.clawdbot/` is still supported).

---

## Build & Install

```bash
pnpm openclaw:install      # Install dependencies
pnpm openclaw:ui:build     # Build the UI
pnpm openclaw:build        # Build the CLI
```

---

## Gateway

```bash
pnpm openclaw gateway                # Run the gateway
pnpm openclaw gateway status         # Check gateway status
pnpm openclaw gateway --port 18789   # Run on custom port
pnpm openclaw gateway --force        # Kill existing listener and start
```

Shortcut scripts (from project root):
```bash
pnpm gateway:run:dev      # Gateway on loopback:19001 (dev profile)
pnpm gateway:run:lan      # Gateway on 0.0.0.0:19001 (LAN access)
pnpm gateway:status:dev   # Check dev gateway status
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

- **Prod profile**: `~/.openclaw/` (default; legacy `~/.clawdbot/` supported)
- **Dev profile**: `~/.openclaw-dev/` (use `--dev` flag)
- **Custom profile**: `--profile <name>` uses `~/.openclaw-<name>/`

Docs: https://docs.openclaw.ai/cli
