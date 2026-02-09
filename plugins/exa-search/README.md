# exa-search plugin

This plugin adds an agent tool:

- `exa_search`

`exa_search` calls Exa's `POST /search` API and includes:

- retry with exponential backoff (`429`, `5xx`, network, timeout)
- timeout control
- in-memory TTL cache + in-flight deduplication
- domain/date/category filters
- optional text/summary/highlights content extraction

## Required config

Set one of:

- `plugins.entries.exa-search.config.apiKey`
- `EXA_API_KEY` env var

## Example tool call

```json
{
  "query": "OpenAI o3 release notes",
  "type": "neural",
  "numResults": 8,
  "includeDomains": ["openai.com"],
  "includeContentText": true,
  "includeContentSummary": true
}
```
