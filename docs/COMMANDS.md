# Moltbot Commands Reference

This project uses a local pnpm build. All commands are run via:

```bash
pnpm moltbot <command> <subcommand> [options]
```

Run from either `clawdbot-platform/` or `moltbot-ac/`. Uses prod profile at `~/.clawdbot/`.

---

## Build & Install

```bash
pnpm moltbot:install      # Install dependencies
pnpm moltbot:ui:build     # Build the UI
pnpm moltbot:build        # Build the CLI
```

---

## Gateway

```bash
pnpm moltbot gateway                # Run the gateway
pnpm moltbot gateway status         # Check gateway status
pnpm moltbot gateway --port 18789   # Run on custom port
pnpm moltbot gateway --force        # Kill existing listener and start
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
pnpm moltbot memory status    # Show memory search index status
pnpm moltbot memory index     # Reindex memory files
pnpm moltbot memory search    # Search memory files
```

---

## Messaging

```bash
pnpm moltbot message send --target +15555550123 --message "Hi"
pnpm moltbot message send --channel telegram --target @mychat --message "Hi"
```

---

## Agent

```bash
pnpm moltbot agent --to +15555550123 --message "Run summary"
pnpm moltbot agent --to +15555550123 --message "Run summary" --deliver
pnpm moltbot agents         # Manage isolated agents
```

---

## Channels & Sessions

```bash
pnpm moltbot channels                   # Channel management
pnpm moltbot channels login --verbose   # Link WhatsApp Web (show QR)
pnpm moltbot sessions                   # List conversation sessions
```

---

## Skills

```bash
pnpm moltbot skills         # Skills management
```

---

## Health & Diagnostics

```bash
pnpm moltbot health         # Fetch health from running gateway
pnpm moltbot status         # Show channel health and recent sessions
pnpm moltbot doctor         # Health checks + quick fixes
pnpm moltbot logs           # Gateway logs
```

---

## Setup & Configuration

```bash
pnpm moltbot setup                              # Initialize config and workspace
pnpm moltbot setup --mode local --non-interactive
pnpm moltbot onboard                            # Interactive setup wizard
pnpm moltbot configure                          # Set up credentials/devices
pnpm moltbot config                             # Config helpers (get/set/unset)
```

---

## Browser

```bash
pnpm moltbot browser        # Manage dedicated browser (Chrome/Chromium)
```

---

## Other Utilities

```bash
pnpm moltbot dashboard      # Open Control UI
pnpm moltbot tui            # Terminal UI
pnpm moltbot plugins        # Plugin management
pnpm moltbot webhooks       # Webhook helpers
pnpm moltbot cron           # Cron scheduler
```

---

## Help

```bash
pnpm moltbot --help             # Show all commands
pnpm moltbot <command> --help   # Show help for specific command
```

---

## Notes

- **Prod profile**: `~/.clawdbot/` (default)
- **Dev profile**: `~/.clawdbot-dev/` (use `--dev` flag)
- **Custom profile**: `--profile <name>` uses `~/.clawdbot-<name>/`

Docs: https://docs.molt.bot/cli
