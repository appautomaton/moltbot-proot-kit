# `bots/` (repo-local OpenClaw state)

This folder is the repo-local **state directory** for OpenClaw (pairing codes, credentials, channel sessions, memory DB, logs, etc).

- Treat everything under `bots/` as **sensitive**.
- Keep it **out of git**. This repo intentionally tracks only:
  - `bots/README.md`
  - `bots/openclaw.json`

## Bootstrap (use this repo as state)

1) Copy `config/.env.template` → `config/.env`

2) In `config/.env`, set:

- `OPENCLAW_STATE_DIR="bots"` (repo-relative; resolved from repo root by `scripts/openclaw.mjs`)

3) Ensure `bots/openclaw.json` points to the versioned source config entrypoint:

```json5
{ $include: "../config/openclaw/openclaw.json5" }
```

4) Start:

```bash
pnpm openclaw gateway
```

The wrapper will render the modular source tree into `bots/.runtime/openclaw.runtime.json5` before launch. Runtime config writes stay there instead of flattening the tracked files under `config/openclaw/`.

## Migrate from `~/.openclaw/` into `bots/`

1) Stop the gateway first (avoid copying while files are being written):

```bash
pnpm openclaw gateway stop
```

2) Backup your old state:

```bash
cp -a ~/.openclaw ~/.openclaw.bak
```

3) Copy into this repo:

```bash
rsync -a ~/.openclaw/ bots/
```

4) Re-apply this repo’s source config entrypoint (recommended):

- Keep `bots/openclaw.json` as the include file that points to `config/openclaw/openclaw.json5`.
- Keep secrets in `config/.env` (never in git).

5) Start again:

```bash
pnpm openclaw gateway
```
