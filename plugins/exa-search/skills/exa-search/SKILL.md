---
name: exa-search
description: Use Exa Search API via `exa_search` for high-signal web retrieval and citation-ready summaries.
metadata: { "openclaw": { "emoji": "🔎", "homepage": "https://exa.ai" } }
---

# Exa Search (Skill)

Use the `exa_search` tool to retrieve high-signal sources from the public web, then write a concise, citation-ready answer.

## When to Activate

Activate when the user:

- Asks for **research**, **sources**, **citations**, or “search online”
- Wants **high-signal** / **less SEO** search results
- Uses a prompt starting with **`/exa`** (treat the rest as the query)

## How to Use

1. Turn the user request into a tight search query (include key entities + constraints).
2. Call `exa_search` with `includeHighlights: true` (default) to get snippets.
3. If deeper reading is needed, set `includeText: true` and keep `textMaxCharacters` small.
4. Summarize findings and **cite** each claim with the URL(s) returned by Exa.

## Recommended Defaults

- `numResults`: 5–10
- `includeHighlights`: true
- `includeText`: false (turn on only when needed)
- `includeSummary`: false (turn on when you want Exa to draft per-URL summaries)

## Notes / Failure Modes

- If the tool errors with “Missing Exa API key”, the host needs to set `EXA_API_KEY` (this repo uses `config/.env`) and restart.
- If results are off-topic, tighten the query and/or use `includeDomains` / `excludeDomains`.

