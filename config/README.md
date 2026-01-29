# Configuration Reference

This directory contains **reference configuration files** for users who have already completed the initial setup.

## Prerequisites

You must first run the initial setup wizard:

```bash
pnpm moltbot setup --mode local --non-interactive
```

This creates your actual config at `~/.moltbot/moltbot.json`.

## File Structure

```
config/
├── moltbot.json      # Reference config (DO NOT use directly)
├── .env              # Your secrets (gitignored, create from template)
├── .env.template     # Template showing required variables
└── README.md         # This file
```

## How It Works

The wrapper script [`scripts/moltbot.mjs`](../scripts/moltbot.mjs) automatically loads `config/.env` before running Moltbot. This allows you to use environment variable substitution in your `~/.moltbot/moltbot.json`:

```json
{
  "apiKey": "${MY_API_KEY}"
}
```

Moltbot reads `MY_API_KEY` from the environment at runtime — your secrets never touch the JSON file.

## Customizing Your Setup

1. **Run the initial setup first** (if you haven't):
   ```bash
   pnpm moltbot setup --mode local --non-interactive
   ```

2. **Create your `.env` from template**:
   ```bash
   cp config/.env.template config/.env
   # Edit config/.env with your actual API keys
   ```

3. **Customize `~/.moltbot/moltbot.json`**:
   - Refer to `config/moltbot.json` as an example
   - Use `${ENV_VAR_NAME}` syntax for secrets
   - Add variables to your `config/.env` as needed
   - Consult the [Moltbot docs](https://docs.molt.bot/gateway/configuration) or ask **Claude Code / Codex** for help

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

- **`config/moltbot.json` is reference only** — Your actual config lives at `~/.moltbot/moltbot.json`
- **Never commit `.env`** — It's gitignored for a reason
- **Never hardcode secrets in JSON** — Always use `${VAR}` substitution

## Validation

```bash
pnpm moltbot doctor        # Check configuration
pnpm moltbot doctor --fix  # Auto-fix issues
```

## References

- [Moltbot Documentation](https://docs.molt.bot/)
- [Configuration Guide](https://docs.molt.bot/gateway/configuration)
- [`scripts/moltbot.mjs`](../scripts/moltbot.mjs) — See how env loading works
