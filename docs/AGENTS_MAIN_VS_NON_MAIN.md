# Main vs Non‑Main Agents (and why non‑main agents can "lag")

**Key idea:** Agents have separate session stores, and skills are snapshotted per session.

## Quick Reference

| Aspect              | Main agent                        | Non-main agent (e.g. `kimi`)       |
|---------------------|-----------------------------------|------------------------------------|
| Session store       | `bots/agents/main/...`            | `bots/agents/<id>/...`             |
| Skills refresh      | Gateway auto-refreshes            | CLI reuses cached snapshot         |
| Sandbox (`non-main`)| Runs direct                       | May be sandboxed                   |

## Terminology

| Term             | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| Agent ID         | Configured agent name (e.g. `main`, `kimi`) from `config/openclaw.json`      |
| Session key      | Stable identifier like `agent:kimi:main` for state lookup                   |
| State dir        | `bots/` in this repo (override via `OPENCLAW_STATE_DIR` only intentionally) |
| Workspace        | Working directory for files/repo ops (usually `bots/workspaces/<agent>`)    |
| Skills snapshot  | Cached skill list stored in session entry (`skillsSnapshot`)                |

## Why Non-Main Agents Lag on Skills

```
Session exists? ──No──► Build new skillsSnapshot
      │
     Yes
      │
      ▼
skillsSnapshot present? ──No──► Build new skillsSnapshot
      │
     Yes
      │
      ▼
Reuse cached snapshot (may be stale)
```

**Root cause:** CLI only rebuilds snapshots for new sessions or when `skillsSnapshot` is missing.
Gateway refreshes via skill watcher versioning; CLI does not.

## Sandbox Gotcha (`sandbox.mode = non-main`)

| Session key          | Behavior     |
|----------------------|--------------|
| `agent:kimi:main`    | Runs direct  |
| `agent:kimi:other`   | Sandboxed    |

Switching session keys to refresh skills may also change sandbox policy, filesystem access, and visible binaries.

## Adding a Non-Main Agent

Adding an agent to `config/openclaw.json` is not enough - you must also register it:

```bash
pnpm openclaw agents add kimi
```

This creates the agent's state directory (`bots/agents/kimi/`) so the gateway/frontend recognizes it.

## Commands

| Action                  | Command                                                                      |
|-------------------------|------------------------------------------------------------------------------|
| Register new agent      | `pnpm openclaw agents add <id>`                                               |
| List configured agents  | `pnpm openclaw agents list`                                                   |
| List main sessions      | `pnpm openclaw sessions`                                                      |
| List kimi sessions      | `pnpm openclaw sessions --store bots/agents/kimi/sessions/sessions.json` |

## Refreshing Skills / Starting a New Session

The CLI has no `--session-key` or `--new-session` flag. Sessions are identified by a derived key (e.g. `agent:kimi:main`) and reset automatically based on policy (daily at 4am or after idle timeout).

**Manual options:**

| Goal                     | Method                                                                 |
|--------------------------|------------------------------------------------------------------------|
| Refresh skills only      | Delete `skillsSnapshot` field from session entry in `sessions.json`   |
| Start fresh session      | Delete entire `agent:<id>:main` entry from `sessions.json`            |
| Use different session    | Pass `--to <E.164>` to derive a different session key                 |

## Troubleshooting Checklist

- [ ] Correct agent session store? (`main` vs `kimi`)
- [ ] Correct session key? (`agent:<id>:main` vs other)
- [ ] Stale `skillsSnapshot`? Refresh before debugging PATH/binaries
