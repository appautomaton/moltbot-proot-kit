# Plugins (`plugins/`)

This folder holds **repo-local OpenClaw plugins** (custom tools / skills) that live **outside** the `openclaw/` submodule.

## How plugins are loaded

- OpenClaw discovers extra plugins via `plugins.load.paths` in `config/openclaw/plugins.json5`.
- This repo config points `plugins.load.paths` at `plugins/` (anchored via `OPENCLAW_STATE_DIR`).
- Plugins are **allowlisted** in `config/openclaw/plugins.json5` to avoid loading unknown code by accident.

## Exa Search plugin

- Plugin id: `exa-search`
- Tool: `exa_search`
- Skill pack: `exa-search` (shipped by the plugin)
- Requires: `EXA_API_KEY` in `config/.env` (tool errors if missing; gateway still starts)

