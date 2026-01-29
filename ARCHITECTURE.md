# ARCHITECTURE (moltbot-platform / moltbot-ac)

This repo is a thin wrapper around the real pnpm workspace in `moltbot-ac/`.
The primary goal is: **build `moltbot-ac/dist/`, run the Gateway, and serve the Control UI from that dist output**.

## Repository Layout

```
moltbot-platform/                       (wrapper workspace)
├─ package.json                         (wrapper scripts: pnpm --dir moltbot-ac ...)
├─ AGENTS.md                            (agent instructions)
└─ moltbot-ac/                          (Moltbot fork; real pnpm workspace)
   ├─ pnpm-workspace.yaml               (packages: ., ui, extensions/*)
   ├─ package.json                      (CLI + build scripts)
   ├─ src/                              (TypeScript backend: CLI, gateway, channels, etc.)
   ├─ ui/                               (Vite+Lit Control UI frontend)
   ├─ extensions/*                      (optional plugin packages)
   └─ dist/                             (build outputs consumed at runtime)
```

## Big Picture: Runtime Topology

```
                    ┌────────────────────────────────────────────┐
Browser             │  Gateway (single process)                  │
┌───────────────┐   │                                            │
│ Control UI    │   │  HTTP server: serves static UI + endpoints  │
│ (SPA assets)  │◄──┼── GET  /... (Control UI from dist)          │
│               │   │   - dist/control-ui/index.html + assets/*   │
│  WS client    │◄──┼── WS   ws(s)://host:port  (Gateway protocol)│
└───────────────┘   │                                            │
                    └────────────────────────────────────────────┘
```

In other words, the Gateway is both:
- a **WebSocket server** (Control UI + nodes connect here), and
- an **HTTP server** (Control UI static files + optional HTTP APIs).

## Major Components (Where to Look)

### 1) CLI (`moltbot` binary)
- Source entrypoint: `moltbot-ac/src/entry.ts`
- The CLI is Commander-based with lazy-loaded subcommands. The important one here is `gateway`.
- Wrapper repo provides scripts like `pnpm gateway:run:dev` that call into `moltbot-ac`.

### 2) Gateway server (`moltbot gateway ...`)
- Starts via: `moltbot-ac/src/cli/gateway-cli/run.ts` → `startGatewayServer(...)`
- Assembled in: `moltbot-ac/src/gateway/server.impl.ts`
- HTTP routing (including Control UI): `moltbot-ac/src/gateway/server-http.ts`
- WS handshake/auth flow: `moltbot-ac/src/gateway/server/ws-connection/*`

### 3) Control UI (frontend)
- Vite build config: `moltbot-ac/ui/vite.config.ts`
- SPA code: `moltbot-ac/ui/src/ui/*`
- The browser connects to the gateway by default at:
  - `ws(s)://<current host>` (derived from `window.location`)
  - see `moltbot-ac/ui/src/ui/storage.ts` and `moltbot-ac/ui/src/ui/gateway.ts`

### 4) Extensions (plugin packages)
- `moltbot-ac/extensions/*` are pnpm workspace packages.
- Each extension declares a `moltbot.extensions` entrypoint in its `package.json`
  (example: `moltbot-ac/extensions/imessage/package.json`).

## Build Pipeline (How `dist/` Is Produced)

### A) Backend TypeScript → `moltbot-ac/dist/`

```
pnpm --dir moltbot-ac build
└─ tsc -p tsconfig.json
   └─ emits JS into moltbot-ac/dist/** mirroring moltbot-ac/src/**
      (rootDir=src, outDir=dist)
```

Moltbot’s build also runs a few “copy/generate” steps that write into `dist/`:
- copies canvas-host A2UI bundle into `dist/canvas-host/a2ui/`
- copies bundled hook metadata into `dist/hooks/bundled/**`
- writes `dist/build-info.json` and `dist/.buildstamp`

### B) Control UI (Vite) → `moltbot-ac/dist/control-ui/`

```
pnpm --dir moltbot-ac ui:build
└─ node scripts/ui.js build
   └─ (runs pnpm in moltbot-ac/ui/)
      └─ vite build
         └─ outputs to moltbot-ac/dist/control-ui/
            ├─ index.html
            └─ assets/*
```

## Serving the Control UI from `dist/`

```
HTTP request
  │
  ├─ if control UI enabled:
  │    handleControlUiHttpRequest(req,res,{ basePath, config })
  │      ├─ resolves control-ui root directory (prefers dist/control-ui)
  │      ├─ serves /assets/* files directly
  │      └─ serves index.html for SPA routes (fallback)
  │
  └─ else: 404
```

Practical implication:
- If `moltbot-ac/dist/control-ui/index.html` doesn't exist, the Gateway will respond with a
  “Control UI assets not found” error and tell you to run `pnpm ui:build`.

## Profiles and State Directories (Why `--dev` matters)

The CLI supports profiles (`--profile <name>`) and a shortcut `--dev`.
These set where config/state lives (by default under your home directory):

```
--profile default  → ~/.moltbot/
--dev              → ~/.moltbot/
```

Key env vars filled by profile logic:
- `MOLTBOT_STATE_DIR` (preferred) / `CLAWDBOT_STATE_DIR` (legacy)
- `MOLTBOT_CONFIG_PATH` (preferred) / `CLAWDBOT_CONFIG_PATH` (legacy)
  - default config filename is `moltbot.json` (legacy `clawdbot.json` is still supported)
- `CLAWDBOT_PROFILE`

The wrapper repo’s default dev gateway run script uses:
- `--dev` (so config/state is isolated)
- `--bind loopback` (safer default)
- `--port 19001`

## Common Commands (from `moltbot-platform/` root)

```
pnpm moltbot:install
pnpm moltbot:ui:build
pnpm moltbot:build

CLAWDBOT_GATEWAY_TOKEN=change-me pnpm gateway:run:dev
```

## Debugging “UI not showing”

Checklist:
1) Does `moltbot-ac/dist/control-ui/index.html` exist?
   - If not: run `pnpm moltbot:ui:build`
2) Is the Gateway actually serving HTTP on the port you expect?
   - wrapper defaults to `127.0.0.1:19001` in dev mode
3) If you’re behind a reverse proxy or on plain HTTP (not localhost), Control UI auth may require extra config:
   - `gateway.controlUi.allowInsecureAuth` (token-only fallback) and/or TLS/localhost secure context.
