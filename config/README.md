# Configuration Reference

This directory contains the repo-local configuration used by this monorepo wrapper.

## Prerequisites

Copy `config/.env.template` to `config/.env` and fill in the values you use. The wrapper reads `config/.env` automatically.

## File Structure

```
config/
├── openclaw.json      # Modular config entrypoint (JSON5; supports $include)
├── openclaw.d/        # Config fragments (JSON5)
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

This repo’s `config/openclaw.json` is **modular**: it uses OpenClaw’s JSON5 `$include` directive to merge files from `config/openclaw.d/` into one effective config.

When you run `pnpm openclaw gateway` from this repo, the wrapper also starts a small bridge for modular configs: it watches `openclaw.d/*.json5` next to the active config and "touches" the root `openclaw.json` so the gateway's existing reload path is triggered.

The wrapper also watches `config/.env` for gateway runs. When `.env` changes, the wrapper gracefully replaces the gateway child so new env-backed config values take effect without a manual restart.

Manual wrapper restart uses the same controlled child replacement path:

```bash
pnpm openclaw:gateway:restart
pnpm openclaw:gateway:restart -- --dev
pnpm openclaw:gateway:restart -- --profile qa
```

## Customizing Your Setup

1. **Create your `.env` from template**:
   ```bash
   cp config/.env.template config/.env
   # Edit config/.env with your actual API keys
   ```

2. **Customize `config/openclaw.json` and `config/openclaw.d/`**:
   - `config/openclaw.json` is the active entrypoint in this repo
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
| `EXA_API_KEY` | Exa API for `exa_search` plugin |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `GATEWAY_AUTH_TOKEN` | Gateway authentication token |
| `XDG_CONFIG_HOME` | GOG config directory (for Google OAuth) |
| `GOG_KEYRING_PASSWORD` | GOG keyring decryption password |

## Important Notes

- `OPENCLAW_CONFIG_PATH=config/openclaw.json` points OpenClaw at this repo’s modular config.
- Set `OPENCLAW_INCLUDE_TOUCH_BRIDGE=0` to disable the wrapper's fragment-watch bridge.
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
