# Custom Model Endpoints (OpenAI-style + Anthropic-style)

This doc explains how OpenClaw reads config, resolves an agent, and then talks to a **custom model endpoint** using:

- **OpenAI-style** APIs (`openai-completions` or `openai-responses`) with a `baseUrl` + access token
- **Anthropic-style** Messages API (`anthropic-messages`) with a `baseUrl` + access token

It is written against the current `openclaw/` source code (not guesses).

---

## Terms (avoid confusion)

```
You configure an UPSTREAM endpoint      OpenClaw Gateway may ALSO expose an endpoint
for the agent to call:                 for other clients to call:

  models.providers.*.baseUrl  ---->      POST /v1/chat/completions   (optional)
  models.providers.*.apiKey            POST /v1/responses           (optional)
```

- **Upstream endpoint**: the model server you want OpenClaw to call (you provide `baseUrl` + token).
- **Gateway endpoint**: OpenClaw’s own HTTP server endpoints (OpenAI-compatible). This is separate.

---

## How OpenClaw reads config and “creates agents” (actual code path)

### 1) Config load pipeline

At runtime, OpenClaw loads config via `loadConfig()`:

- Config file location is controlled by `OPENCLAW_CONFIG_PATH` (preferred) or `CLAWDBOT_CONFIG_PATH` (legacy).
  If unset, it defaults to:
  - state dir: `~/.openclaw`
  - config path: `~/.openclaw/openclaw.json`

- Reads `openclaw.json` (or legacy `clawdbot.json`) as **JSON5**
- Resolves `$include` directives
- Applies `${ENV_VAR}` substitutions (uppercase vars only)
- Validates against the Zod schema
- Applies defaults + normalizes paths

Code references:
- `openclaw/src/config/io.ts` (the `createConfigIO().loadConfig()` pipeline)
- `openclaw/src/config/paths.ts` (state dir + config path resolution, incl. legacy compatibility)
- `openclaw/src/cli/profile.ts` (CLI `--dev` / `--profile` parsing and env defaults)
- `openclaw/src/config/env-substitution.ts` (`${ENV_VAR}` support)
- `openclaw/src/config/zod-schema.*.ts` (schema)

### 2) Agent resolution (multi-agent)

Agents are config entries; they are not separate processes. On each run, OpenClaw resolves:

- `agentId` (from session key or request header/model hint)
- `workspaceDir` (where it reads `AGENTS.md`, `MEMORY.md`, etc.)
- `agentDir` (where it stores agent state like `auth-profiles.json`, `models.json`, sessions, etc.)

Key logic:
- Default agent id is `"main"` when `agents.list` is empty.
- Non-default agents get a different default workspace unless you override it.

Code references:
- `openclaw/src/agents/agent-scope.ts` (`resolveDefaultAgentId`, `resolveAgentWorkspaceDir`, `resolveAgentDir`)
- `openclaw/src/commands/agent.ts` (loads config → resolves agentId/workspaceDir/agentDir → runs agent)
- `openclaw/src/gateway/http-utils.ts` (Gateway HTTP routes choose agentId from headers/model)

### Control UI note: why a new agent “doesn’t show up” until you run it once

The Control UI **Sessions** list shows **sessions** (conversation keys), not the configured agent list.
So after you add `agents.list[]`, you may not see `agent:<id>:main` in Sessions until the first run creates it.

Create/initialize the session (either one):

```bash
pnpm openclaw --dev agent --agent kimi --message "hi"
```

Reuse the same session (stable key, no new session key):

```bash
pnpm openclaw --dev agent --agent kimi --session-key agent:kimi:main --message "..."
```

List sessions from the CLI:

```bash
# Default agent (resolved from config; usually agent:main)
pnpm openclaw --dev sessions

# A specific agent’s store (example: kimi)
pnpm openclaw --dev sessions --store ~/.openclaw/agents/kimi/sessions/sessions.json
```

---

## Configure a custom **OpenAI-style** upstream model endpoint (baseUrl + token)

### Step 1) Add a provider under `models.providers`

You define a provider key (any string, e.g. `custom-proxy`) and specify:

- `baseUrl`: your upstream API base URL
- `api`: which protocol to speak (`openai-completions` or `openai-responses`)
- `apiKey`: your access token (either inline or `${ENV_VAR}`)
- `models`: at least one `{ id, name }`

Schema reference:
- `openclaw/src/config/types.models.ts` (`ModelProviderConfig`, `ModelApi`)

### Step 2) Point an agent at `providerKey/modelId`

Set either:

- global default: `agents.defaults.model.primary`
- per-agent override: `agents.list[].model`

Schema reference:
- `openclaw/src/config/zod-schema.agent-defaults.ts` (defaults model shape)
- `openclaw/src/config/zod-schema.agent-runtime.ts` (per-agent model accepts string or `{primary,fallbacks}`)

### Example: OpenAI Chat Completions-style upstream

This assumes your upstream implements an OpenAI-compatible **Chat Completions** endpoint.

```json
{
  "models": {
    "providers": {
      "custom-proxy": {
        "baseUrl": "http://127.0.0.1:4000/v1",
        "api": "openai-completions",
        "apiKey": "${CUSTOM_PROXY_API_KEY}",
        "models": [
          { "id": "llama-3.1-8b", "name": "Llama 3.1 8B (via proxy)" }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "workspace": "/home/dev/clawd-dev",
      "model": { "primary": "custom-proxy/llama-3.1-8b" }
    }
  }
}
```

Notes (from code, not vibes):
- Missing model fields like `contextWindow/maxTokens/cost/input/reasoning` are defaulted by config defaults. See `openclaw/src/config/defaults.ts` (`applyModelDefaults`).
- For OpenAI-style providers, OpenClaw’s own implicit providers use `/v1` in `baseUrl` (examples: Moonshot/Ollama). See `openclaw/src/agents/models-config.providers.ts`.

### Example: OpenAI Responses-style upstream

Use this only if your upstream implements the OpenAI **Responses** API.

```json
{
  "models": {
    "providers": {
      "custom-responses": {
        "baseUrl": "https://YOUR_UPSTREAM_HOST/v1",
        "api": "openai-responses",
        "apiKey": "${CUSTOM_RESPONSES_API_KEY}",
        "models": [
          { "id": "gpt-like", "name": "OpenAI Responses compatible model" }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "custom-responses/gpt-like" }
    }
  }
}
```

---

## Configure a custom **Anthropic-style** upstream model endpoint (baseUrl + token)

OpenClaw supports calling Anthropic **Messages** API via:

- provider `api: "anthropic-messages"`

Example (custom Anthropic-compatible proxy):

```json
{
  "models": {
    "providers": {
      "anthropic-proxy": {
        "baseUrl": "https://YOUR_UPSTREAM_HOST",
        "api": "anthropic-messages",
        "apiKey": "${ANTHROPIC_PROXY_API_KEY}",
        "models": [
          { "id": "claude-opus-4-5", "name": "Claude Opus 4.5 (via proxy)" }
        ]
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "workspace": "/home/dev/clawd-dev",
        "model": "openai-codex/gpt-5.2"
      },
      {
        "id": "claude",
        "workspace": "/home/dev/clawd-dev",
        "model": "anthropic-proxy/claude-opus-4-5"
      }
    ]
  }
}
```

Important nuance:
- Anthropic shorthand normalization like `anthropic/opus-4.5 -> anthropic/claude-opus-4-5` only happens when the provider id is exactly `anthropic`. For custom provider keys (like `anthropic-proxy`), use the full model id. See `openclaw/src/agents/model-selection.ts`.

Anthropic-style baseUrl example in this repo:
- MiniMax exposes an Anthropic-compatible endpoint at `https://api.minimax.io/anthropic` (note: not `/v1`). See `openclaw/src/agents/models-config.providers.ts`.

---

## Where does the access token come from?

OpenClaw resolves provider API keys in this order:

1) `auth-profiles.json` (profile rotation supported)
2) environment variables for **built-in provider ids** (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)
3) `models.providers.<providerKey>.apiKey` from config

Code references:
- `openclaw/src/agents/model-auth.ts` (`resolveApiKeyForProvider`)
- `openclaw/src/agents/auth-profiles/store.ts` (main + per-agent store merge)

If your provider key is custom (e.g. `custom-proxy`), there is **no built-in env var mapping**. Use either:

- config substitution: `"apiKey": "${CUSTOM_PROXY_API_KEY}"`
- or `auth-profiles.json` with `provider: "custom-proxy"`

Minimal `auth-profiles.json` entry shape:

```json
{
  "version": 1,
  "profiles": {
    "custom-proxy:default": { "type": "api_key", "provider": "custom-proxy", "key": "sk-..." }
  }
}
```

---

## Does the Gateway expose Anthropic-format HTTP endpoints?

Not currently.

The Gateway can serve OpenAI-compatible HTTP endpoints (when enabled):

- `POST /v1/chat/completions` (see `openclaw/src/gateway/openai-http.ts`)
- `POST /v1/responses` (see `openclaw/src/gateway/openresponses-http.ts`)

Those routes are conditionally enabled by config:
- `gateway.http.endpoints.chatCompletions.enabled`
- `gateway.http.endpoints.responses.enabled`

See `openclaw/src/gateway/server-http.ts` and option docs in `openclaw/src/gateway/server.impl.ts`.

If you need `POST /v1/messages` (Anthropic) as a Gateway server endpoint, that would require new server code; there is no `anthropic-http.ts` equivalent today.
