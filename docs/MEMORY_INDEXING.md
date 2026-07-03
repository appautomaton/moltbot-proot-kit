# Memory Indexing (SQLite) — Sources, Sessions, and “Why my DB is empty”

This doc is written against the current `openclaw/` source code (no guesses).

OpenClaw’s default long‑term memory search (`memory-core`) is **SQLite-backed indexing** of specific
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

  <STATE_DIR>/memory/<agentId>.sqlite
        |
        |  (memory_search queries this DB)
        v
Layer 3: Retrieval tool

  memory_search / memory_get
```

Separately, OpenClaw always stores **session transcripts**:

```
<STATE_DIR>/agents/<agentId>/sessions/*.jsonl
```

These transcripts are **not indexed into SQLite** unless you explicitly enable session indexing.

`<STATE_DIR>` is the OpenClaw state directory. In this wrapper repo it defaults to `bots/`; use `OPENCLAW_STATE_DIR` only for an intentional override.
See: `openclaw/src/config/paths.ts` (`resolveStateDir`)

---

## Where do `MEMORY.md` and `memory/*.md` come from?

They live in the agent **workspace directory** (the “working folder” the agent can read/write).

- This repo's wrapper points workspaces at repo-local `bots/workspaces/<agent>` paths.
- You (or the agent) typically create `MEMORY.md` and `memory/YYYY-MM-DD.md` manually as durable notes.
- There is also an automatic “pre-compaction memory flush” feature that can prompt the agent to write
  durable notes to disk near compaction, but it does **not** run on every message.
  - See: `openclaw/src/auto-reply/reply/memory-flush.ts`

The memory indexer only considers these paths as “memory files”:

- `MEMORY.md` / `memory.md`
- `memory/**/*.md`

See: `openclaw/src/memory/internal.ts` (`isMemoryPath`, `listMemoryFiles`)

---

## Why didn’t SQLite “grow with chat history”?

Because **default indexing sources are memory files**, not session transcripts.

Default sources:

- `agents.defaults.memorySearch.sources` defaults to `["memory"]`
  - See: `openclaw/src/agents/memory-search.ts` (`DEFAULT_SOURCES`)

Session transcripts are gated behind an experimental flag:

- `agents.defaults.memorySearch.experimental.sessionMemory` must be `true`
  - See: `openclaw/src/agents/memory-search.ts` (`normalizeSources(...)`)

Even if transcripts exist, they won’t be indexed unless both:

1) session indexing is enabled, and
2) `"sessions"` is included in `sources`

---

## How to enable sessions as a memory source (SQLite)

Edit the repo source config under `config/openclaw/` (the wrapper renders it to `bots/.runtime/openclaw.runtime.json5`) to include:

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

- The memory index manager subscribes to session transcript updates and tracks per-file deltas.
  - See: `openclaw/src/memory/manager.ts` (`ensureSessionListener()`)
- Session transcripts are indexed in batches when a file grows “enough” (defaults: `deltaBytes=100_000`, `deltaMessages=50`), triggering a background sync.
  - See: `openclaw/src/agents/memory-search.ts` (`DEFAULT_SESSION_DELTA_BYTES`, `DEFAULT_SESSION_DELTA_MESSAGES`)
  - See: `openclaw/src/memory/manager.ts` (`processSessionDeltaBatch()`)
- Session `.jsonl` files are read, normalized into text, chunked, embedded, and stored in the same SQLite DB.

---

## How to *trigger* indexing (SQLite)

Indexing is **lazy**: the memory index manager is created on demand (tool/CLI), not as an always-on daemon.

### Automatic sync (when running)

Once the memory index manager is alive (e.g., after the first `memory_search` call in a running gateway/daemon), it keeps the index reasonably fresh without manual CLI runs:

- `sync.watch = true`: watches `MEMORY.md` + `memory/` and schedules a background sync after changes (debounced).
  - See: `openclaw/src/memory/manager.ts` (`ensureWatcher()`, `scheduleWatchSync()`)
- `sync.onSearch = true`: if the index is dirty, a `memory_search` call schedules a background sync.
  - See: `openclaw/src/memory/manager.ts` (`search()` → `sync({ reason: "search" })`)
- `sync.onSessionStart = true`: the **first** `memory_search` call in a given session triggers a background sync.
  - This is keyed off the session key; it does not mean “when a session record is created”.
  - This sync focuses on memory files. Session transcript indexing is triggered separately via session deltas.
  - See: `openclaw/src/memory/manager.ts` (`warmSession()`)
  - See: `openclaw/src/agents/tools/memory-tool.ts` (passes `sessionKey` into `manager.search(...)`)
- `sync.intervalMinutes`: optional periodic background sync (default `0` = off).
  - See: `openclaw/src/memory/manager.ts` (`ensureIntervalSync()`)

One-shot CLI commands (`pnpm openclaw memory ...`) exit immediately, so they do not keep file watchers/interval sync running after the command completes.

Recommended (explicit):

```bash
pnpm openclaw memory index --agent <agentId>
```

Status + optional reindex if dirty:

```bash
pnpm openclaw memory status --agent <agentId> --index   # implies --deep
```

In-chat (implicit):

- Ensure the model calls `memory_search` (it creates the manager and may sync if configured).
  - See: `openclaw/src/agents/tools/memory-tool.ts`

---

## Local embeddings (node-llama-cpp)

If you want memory indexing/search to prefer **local embeddings**, set:

```json5
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "provider": "local",
        "fallback": "none"
      }
    }
  }
}
```

Notes:

- Default local embedding model is:
  - `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf`
  - See: `openclaw/src/memory/embeddings.ts` (`DEFAULT_LOCAL_MODEL`)
- You can override the model via `agents.defaults.memorySearch.local.modelPath` (a local GGUF path or `hf:` URI).
- The first time embeddings are used with `provider = "local"`, the GGUF weights may be auto-downloaded.
  - Default cache location is `~/.node-llama-cpp/models` unless you set `agents.defaults.memorySearch.local.modelCacheDir`.
  - See: `openclaw/docs/concepts/memory.md` (“Local embedding auto-download”)

Useful CLI checks:

```bash
pnpm openclaw memory status --agent <agentId>          # shows requested provider/model + DB path
pnpm openclaw memory status --agent <agentId> --deep   # runs an actual embedding probe ("ping")
```

---

## What does “Dirty” mean?

`Dirty` is an **in-process** “needs sync” flag on the memory index manager:

- On startup, it initializes to `true` whenever `"memory"` is an enabled source.
  - See: `openclaw/src/memory/manager.ts` (`this.dirty = this.sources.has("memory")`)
- It flips to `true` again when `MEMORY.md` / `memory/**/*.md` change (watcher events).
- It flips to `false` after a successful sync/index run.
  - See: `openclaw/src/memory/manager.ts` (`this.dirty = false` after `syncMemoryFiles(...)`)

Note: the CLI `Dirty:` flag reflects changes to **memory files** (`MEMORY.md` / `memory/**/*.md`). Session transcript indexing uses a separate internal “dirty” state and runs via session deltas.

Important: `pnpm openclaw memory status --agent <agentId>` is a **one-shot** command that starts a fresh process, so it can (and often will) print `Dirty: yes` even if the SQLite DB is already up to date.

To “refresh and then report”, run either:

```bash
pnpm openclaw memory index --agent <agentId>
pnpm openclaw memory status --agent <agentId> --index
```

In the long-running gateway/daemon process, the manager instance stays alive and `Dirty` behaves like you’d expect (it becomes `yes` only when memory files change).

---

## State paths (quick reference)

```
state dir:   bots
config:      bots/.runtime/openclaw.runtime.json5
sqlite index <STATE_DIR>/memory/<agentId>.sqlite
sessions:    <STATE_DIR>/agents/<agentId>/sessions/*.jsonl
workspace:   bots/workspaces/<agent> (or whatever config sets as agents.defaults.workspace)
```

The unwrapped upstream default is home-directory state. This repo's wrapper sets `OPENCLAW_STATE_DIR=bots` before launching OpenClaw.
See: `openclaw/src/config/paths.ts` (`resolveStateDir`)

The exact index path is always printed in:

```bash
pnpm openclaw memory status --agent <agentId>
```

Agent IDs:

- If `agents.list` is empty, default agent id is `"main"`.
- If `agents.list` exists, the first `default: true` entry (or first entry) becomes the default.

See: `openclaw/src/agents/agent-scope.ts` (`resolveDefaultAgentId`, `resolveSessionAgentId`)

---

## Troubleshooting checklist (common “DB is empty” causes)

If you see `files=0` / `chunks=0` in `<STATE_DIR>/memory/<agentId>.sqlite`, the usual reasons are:

1) You have no memory files yet:
   - `workspace/MEMORY.md` missing and `workspace/memory/` empty
2) Sessions indexing isn’t enabled:
   - `experimental.sessionMemory` not `true` OR `sources` does not include `"sessions"`
3) Indexing was never triggered:
   - Run `pnpm openclaw memory index --agent <agentId>`
4) Embeddings provider errors (429/timeouts) prevent indexing from completing:
   - Indexing requires embeddings to chunk+store content.
