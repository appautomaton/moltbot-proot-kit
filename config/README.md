# Configuration Reference

This directory contains **reference configuration files** for users who have already completed the initial setup.

## Prerequisites

You must first run the initial setup wizard:

```bash
pnpm openclaw setup --mode local --non-interactive
```

This creates your actual config at `~/.openclaw/openclaw.json`.

## File Structure

```
config/
├── openclaw.json      # Reference config (DO NOT use directly)
├── .env              # Your secrets (gitignored, create from template)
├── .env.template     # Template showing required variables
└── README.md         # This file
```

## How It Works

The wrapper script [`scripts/openclaw.mjs`](../scripts/openclaw.mjs) automatically loads `config/.env` before running OpenClaw. This allows you to use environment variable substitution in your `~/.openclaw/openclaw.json`:

```json
{
  "apiKey": "${MY_API_KEY}"
}
```

OpenClaw reads `MY_API_KEY` from the environment at runtime — your secrets never touch the JSON file.

## Customizing Your Setup

1. **Run the initial setup first** (if you haven't):
   ```bash
   pnpm openclaw setup --mode local --non-interactive
   ```

2. **Create your `.env` from template**:
   ```bash
   cp config/.env.template config/.env
   # Edit config/.env with your actual API keys
   ```

3. **Customize `~/.openclaw/openclaw.json`**:
   - Refer to `config/openclaw.json` as an example
   - Use `${ENV_VAR_NAME}` syntax for secrets
   - Add variables to your `config/.env` as needed
   - Consult the [OpenClaw docs](https://docs.openclaw.ai/gateway/configuration) or ask **Claude Code / Codex** for help

## Environment Variables

See `.env.template` for all available variables. Key ones:

| Variable | Description |
|----------|-------------|
| `NVIDIA_INTEGRATE_API_KEY` | NVIDIA Integrate API for Kimi K2.5 |
| `GEMINI_MEMORY_API_KEY` | Gemini API for memory search |
| `PERPLEXITY_API_KEY` | Perplexity API for web search |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `GATEWAY_AUTH_TOKEN` | Gateway authentication token |
| `XDG_CONFIG_HOME` | GOG config directory (for Google OAuth) |
| `GOG_KEYRING_PASSWORD` | GOG keyring decryption password |

## Important Notes

- **`config/openclaw.json` is reference only** — Your actual config lives at `~/.openclaw/openclaw.json`
- **Never commit `.env`** — It's gitignored for a reason
- **Never hardcode secrets in JSON** — Always use `${VAR}` substitution

## Validation

```bash
pnpm openclaw doctor        # Check configuration
pnpm openclaw doctor --fix  # Auto-fix issues
```

## References

- [OpenClaw Documentation](https://docs.openclaw.ai/)
- [Configuration Guide](https://docs.openclaw.ai/gateway/configuration)
- [`scripts/openclaw.mjs`](../scripts/openclaw.mjs) — See how env loading works
