# Moltbot Configuration Best Practices

This directory contains the configuration files for Moltbot following security and operational best practices.

## File Structure

```
config/
├── moltbot.json      # Main configuration (safe to commit)
├── .env              # Actual secrets (NEVER commit)
├── .env.template     # Template showing required variables (safe to commit)
└── README.md         # This file
```

## Best Practices

### 1. Secret Management

**Never hardcode secrets in `moltbot.json`**. Use environment variable substitution:

```json
{
  "apiKey": "${MY_API_KEY}"
}
```

Moltbot will read `MY_API_KEY` from the environment at runtime.

**Required environment variables for this config:**
- `NVIDIA_INTEGRATE_API_KEY` — NVIDIA Integrate API for Kimi K2.5
- `GEMINI_MEMORY_API_KEY` — Gemini API for memory search
- `PERPLEXITY_API_KEY` — Perplexity API for web search
- `TELEGRAM_BOT_TOKEN` — Telegram bot token from @BotFather
- `GATEWAY_AUTH_TOKEN` — Gateway authentication token

### 2. Agent Sandboxing

Apply the **principle of least privilege**:

| Agent Type | Sandbox? | Rationale |
|------------|----------|-----------|
| Primary/trusted (main) | No | Your daily driver with full access |
| Secondary/experimental | Yes | Restrict capabilities for safety |

Example sandbox configuration:
```json
{
  "id": "experimental-agent",
  "sandbox": {
    "mode": "session",
    "allowedTools": ["bash", "read", "write", "edit"],
    "deniedTools": ["browser", "cron", "nodes"]
  }
}
```

### 3. Gateway Security

- **Bind to loopback** (`"bind": "loopback"`) unless remote access is needed
- **Enable authentication** (`"auth": { "mode": "token" }`)
- **Use Tailscale** for remote access instead of exposing ports publicly
- **Never expose port 19001 to the public internet**

### 4. Channel Security

- **Use `dmPolicy: "pairing"`** — Requires pairing process for new users
- **Use `groupPolicy: "allowlist"`** — Only respond in approved groups
- **Never set `allowlist: "*"`** — This opens your system to anyone

### 5. Model Fallbacks

Configure fallback models for resilience:
```json
{
  "model": {
    "primary": "provider/best-model",
    "fallbacks": [
      "provider/good-model",
      "provider/backup-model"
    ]
  }
}
```

### 6. Heartbeat Configuration

Enable proactive behavior with heartbeat:
```json
{
  "heartbeat": {
    "enabled": true,
    "intervalMs": 1200000
  }
}
```

Then create `HEARTBEAT.md` in your workspace with instructions for periodic checks.

**Recommended intervals:**
- 5 min (300000ms) — Aggressive, high API usage
- 15 min (900000ms) — Balanced
- 30 min (1800000ms) — Conservative

### 7. Browser Security

If using browser automation:
- **Prefer `headless: true`** — No visible browser window
- **Avoid `noSandbox: true`** unless required (e.g., proot environments)
- **Use dedicated browser profiles** — Don't share with personal browsing

## Setup Instructions

1. **Copy the template:**
   ```bash
   cp .env.template .env
   ```

2. **Fill in your secrets in `.env`**

3. **Add `.env` to `.gitignore`:**
   ```bash
   echo ".env" >> ../.gitignore
   ```

4. **Load environment variables before starting Moltbot:**
   ```bash
   # Option A: Source directly
   source config/.env && moltbot gateway

   # Option B: Use direnv (recommended)
   # Install direnv, then create .envrc:
   echo "dotenv config/.env" > ../.envrc
   direnv allow
   ```

5. **Symlink or copy config to ~/.moltbot/:**
   ```bash
   # Option A: Symlink (changes sync automatically)
   ln -sf ~/agents/moltbot-platform/config/moltbot.json ~/.moltbot/moltbot.json

   # Option B: Copy (manual sync needed)
   cp config/moltbot.json ~/.moltbot/moltbot.json
   ```

## Validation

Run the doctor command to validate your configuration:
```bash
moltbot doctor
```

Fix any issues with:
```bash
moltbot doctor --fix
```

## References

- [Moltbot Documentation](https://docs.molt.bot/)
- [AGENTS.md Standard](https://agents.md/)
- [Moltbot Configuration Guide](https://docs.molt.bot/gateway/configuration)
