# Memory Indexing (SQLite) — Sources, Sessions, and “Why my DB is empty”

This doc is written against the current `moltbot-ac/` source code (no guesses).

Moltbot’s default long‑term memory search (`memory-core`) is **SQLite-backed indexing** of specific
sources. It is **not** a “chat history database” by default.

---

## Big picture (3 layers)

```
Layer 1: Sources (human/agent editable)

  Agent workspace:
    MEMORY.md
    memory/**/*.md
        |
        |  (indexer chunks + embeds these files)
        v
Layer 2: Derived index DB (per agent)

  ~/.moltbot/memory/<agentId>.sqlite
        |
        |  (memory_search queries this DB)
        v
Layer 3: Retrieval tool

  memory_search / memory_get
```

Separately, Moltbot always stores **session transcripts**:

```
~/.moltbot/agents/<agentId>/sessions/*.jsonl
```

These transcripts are **not indexed into SQLite** unless you explicitly enable session indexing.

---

## Where do `MEMORY.md` and `memory/*.md` come from?

They live in the agent **workspace directory** (the “working folder” the agent can read/write).

- Dev profile gateway (`moltbot --dev gateway`) bootstraps a dev workspace with files like `AGENTS.md`, `SOUL.md`, etc.
  It does **not** create `MEMORY.md` for you.
  - See: `moltbot-ac/src/cli/gateway-cli/dev.ts` (`ensureDevWorkspace()`)
- You (or the agent) typically create `MEMORY.md` and `memory/YYYY-MM-DD.md` manually as durable notes.
- There is also an automatic “pre-compaction memory flush” feature that can prompt the agent to write
  durable notes to disk near compaction, but it does **not** run on every message.
  - See: `moltbot-ac/src/auto-reply/reply/memory-flush.ts`

The memory indexer only considers these paths as “memory files”:

- `MEMORY.md` / `memory.md`
- `memory/**/*.md`

See: `moltbot-ac/src/memory/internal.ts` (`isMemoryPath`, `listMemoryFiles`)

---

## Why didn’t SQLite “grow with chat history”?

Because **default indexing sources are memory files**, not session transcripts.

Default sources:

- `agents.defaults.memorySearch.sources` defaults to `["memory"]`
  - See: `moltbot-ac/src/agents/memory-search.ts` (`DEFAULT_SOURCES`)

Session transcripts are gated behind an experimental flag:

- `agents.defaults.memorySearch.experimental.sessionMemory` must be `true`
  - See: `moltbot-ac/src/agents/memory-search.ts` (`normalizeSources(...)`)

Even if transcripts exist, they won’t be indexed unless both:

1) session indexing is enabled, and
2) `"sessions"` is included in `sources`

---

## How to enable sessions as a memory source (SQLite)

Edit your profile config (`~/.moltbot/moltbot.json`) to include:

```json
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "experimental": { "sessionMemory": true },
        "sources": ["memory", "sessions"]
      }
    }
  }
}
```

What happens after enabling this:

- The memory index manager subscribes to session transcript updates and marks the index dirty.
  - See: `moltbot-ac/src/memory/manager.ts` (`ensureSessionListener()`)
- Session `.jsonl` files are read, normalized into text, chunked, embedded, and stored in the same SQLite DB.

---

## How to *trigger* indexing (SQLite)

Indexing is **lazy**: the memory index manager is created on demand (tool/CLI), not as an always-on daemon.

Recommended (explicit):

```bash
pnpm moltbot --dev memory index --agent <agentId>
```

Status + optional reindex if dirty:

```bash
pnpm moltbot --dev memory status --agent <agentId> --index --deep
```

In-chat (implicit):

- Ensure the model calls `memory_search` (it creates the manager and may sync if configured).
  - See: `moltbot-ac/src/agents/tools/memory-tool.ts`

---

## State paths (quick reference)

```
state dir:   ~/.moltbot
config:      ~/.moltbot/moltbot.json
sqlite index ~/.moltbot/memory/<agentId>.sqlite
sessions:    ~/.moltbot/agents/<agentId>/sessions/*.jsonl
workspace:   ~/clawd-dev (or whatever config sets as agents.defaults.workspace)
```

Agent IDs:

- If `agents.list` is empty, default agent id is `"main"`.
- If `agents.list` exists, the first `default: true` entry (or first entry) becomes the default.

See: `moltbot-ac/src/agents/agent-scope.ts` (`resolveDefaultAgentId`, `resolveSessionAgentId`)

---

## Troubleshooting checklist (common “DB is empty” causes)

If you see `files=0` / `chunks=0` in `~/.moltbot/memory/<agentId>.sqlite`, the usual reasons are:

1) You have no memory files yet:
   - `workspace/MEMORY.md` missing and `workspace/memory/` empty
2) Sessions indexing isn’t enabled:
   - `experimental.sessionMemory` not `true` OR `sources` does not include `"sessions"`
3) Indexing was never triggered:
   - Run `pnpm moltbot --dev memory index --agent <agentId>`
4) Embeddings provider errors (429/timeouts) prevent indexing from completing:
   - Indexing requires embeddings to chunk+store content.
