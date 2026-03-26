# `dockerfiles/`

Docker build contexts for **sandbox images** used by agents with `sandbox.mode=all` and a `sandbox.docker.image` in `config/openclaw/agents/list/*.json5`.

## Images

| Directory | Image tag | Agent config |
|---|---|---|
| `writer/` | `localhost/openclaw-sandbox-writer:bookworm` | `agents/list/writer.json5` |
| `code-cli/` | `localhost/openclaw-sandbox-code-cli:bookworm-slim` | `agents/list/coder-cli.json5` |

`sandbox-moltbook.json5` references `localhost/openclaw-sandbox-slim:latest` — no build context exists here yet. Build or pull that image separately.

## Build example

```bash
docker build -f dockerfiles/writer/Dockerfile \
  -t localhost/openclaw-sandbox-writer:bookworm \
  dockerfiles/writer
```

## Notes

- Only build images you actually need (i.e. when Docker sandboxing is enabled for that agent).
- Image tags must match what the agent config references.

