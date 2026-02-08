# ARCHITECTURE (openclaw-platform / openclaw)

This repo is a thin wrapper around the real pnpm workspace in `openclaw/`.
The primary goal is: **build `openclaw/dist/`, run the Gateway, and serve the Control UI from that dist output**.

## Repository Layout

```
openclaw-platform/                       (wrapper workspace)
├─ package.json                         (wrapper scripts: pnpm --dir openclaw ...)
├─ AGENTS.md                            (agent instructions)
└─ openclaw/                          (OpenClaw fork; real pnpm workspace)
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

### 1) CLI (`openclaw` binary)
- Source entrypoint: `openclaw/src/entry.ts`
- The CLI is Commander-based with lazy-loaded subcommands. The important one here is `gateway`.
- Wrapper repo exposes `pnpm openclaw ...` plus build helpers (`openclaw:install`, `openclaw:ui:build`, `openclaw:build`).

### 2) Gateway server (`openclaw gateway ...`)
- Starts via: `openclaw/src/cli/gateway-cli/run.ts` → `startGatewayServer(...)`
- Assembled in: `openclaw/src/gateway/server.impl.ts`
- HTTP routing (including Control UI): `openclaw/src/gateway/server-http.ts`
- WS handshake/auth flow: `openclaw/src/gateway/server/ws-connection/*`

### 3) Control UI (frontend)
- Vite build config: `openclaw/ui/vite.config.ts`
- SPA code: `openclaw/ui/src/ui/*`
- The browser connects to the gateway by default at:
  - `ws(s)://<current host>` (derived from `window.location`)
  - see `openclaw/ui/src/ui/storage.ts` and `openclaw/ui/src/ui/gateway.ts`

### 4) Extensions (plugin packages)
- `openclaw/extensions/*` are pnpm workspace packages.
- Each extension declares a `openclaw.extensions` entrypoint in its `package.json`
  (example: `openclaw/extensions/imessage/package.json`).

## Build Pipeline (How `dist/` Is Produced)

### A) Backend TypeScript → `openclaw/dist/`

```
pnpm --dir openclaw build
└─ tsc -p tsconfig.json
   └─ emits JS into openclaw/dist/** mirroring openclaw/src/**
      (rootDir=src, outDir=dist)
```

OpenClaw’s build also runs a few “copy/generate” steps that write into `dist/`:
- copies canvas-host A2UI bundle into `dist/canvas-host/a2ui/`
- copies bundled hook metadata into `dist/hooks/bundled/**`
- writes `dist/build-info.json` and `dist/.buildstamp`

### B) Control UI (Vite) → `openclaw/dist/control-ui/`

```
pnpm --dir openclaw ui:build
└─ node scripts/ui.js build
   └─ (runs pnpm in openclaw/ui/)
      └─ vite build
         └─ outputs to openclaw/dist/control-ui/
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
- If `openclaw/dist/control-ui/index.html` doesn't exist, the Gateway will respond with a
  “Control UI assets not found” error and tell you to build the UI (`pnpm openclaw:ui:build` from wrapper root).

## Profiles and State Directories (Why `--dev` matters)

The CLI supports profiles (`--profile <name>`) and a shortcut `--dev`.
By default (without path overrides like `OPENCLAW_STATE_DIR` / `OPENCLAW_CONFIG_PATH`), these set where config/state lives:

```
--profile default  → ~/.openclaw/
--dev              → ~/.openclaw-dev/
```

Key env vars filled by profile logic:
- `OPENCLAW_STATE_DIR` (preferred) / `CLAWDBOT_STATE_DIR` (legacy)
- `OPENCLAW_CONFIG_PATH` (preferred) / `CLAWDBOT_CONFIG_PATH` (legacy)
  - default config filename is `openclaw.json` (legacy `clawdbot.json` is still supported)
- `OPENCLAW_PROFILE`

Recommended dev gateway command from wrapper root:
- `pnpm openclaw --dev gateway`
- default dev port is `19001`; bind mode follows config `gateway.bind` (fallback `loopback`)

## Common Commands (from `openclaw-platform/` root)

```
pnpm openclaw:install
pnpm openclaw:ui:build
pnpm openclaw:build

OPENCLAW_GATEWAY_TOKEN=change-me pnpm openclaw --dev gateway
```

## Debugging “UI not showing”

Checklist:
1) Does `openclaw/dist/control-ui/index.html` exist?
   - If not: run `pnpm openclaw:ui:build`
2) Is the Gateway actually serving HTTP on the port/bind you expect?
   - with `pnpm openclaw --dev gateway`, default port is `19001`; bind mode comes from config (fallback `loopback`)
3) If you’re behind a reverse proxy or on plain HTTP (not localhost), Control UI auth may require extra config:
   - `gateway.controlUi.allowInsecureAuth` (token-only fallback) and/or TLS/localhost secure context.
