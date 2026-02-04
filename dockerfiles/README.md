# `dockerfiles/`

Docker build contexts for **sandbox images** used by agents that run with `sandbox.mode=all` and a `sandbox.docker.image` setting in `config/openclaw/agents/list/*.json5`.

## What’s here

- `dockerfiles/writer/` — document-oriented sandbox image (example agent config: `config/openclaw/agents/list/writer.json5`)
- `dockerfiles/code-cli/` — coding sandbox image (example agent config: `config/openclaw/agents/list/coder-cli.json5`)
- `dockerfiles/social-info/` — additional sandbox context (if referenced by an agent config)

## Build examples

Build the writer sandbox image referenced by `"image": "localhost/openclaw-sandbox-writer:bookworm"`:

```bash
docker build -f dockerfiles/writer/Dockerfile \
  -t localhost/openclaw-sandbox-writer:bookworm \
  dockerfiles/writer
```

Build the code-cli sandbox image referenced by `"image": "localhost/openclaw-sandbox-code-cli:bookworm-slim"`:

```bash
docker build -f dockerfiles/code-cli/Dockerfile \
  -t localhost/openclaw-sandbox-code-cli:bookworm-slim \
  dockerfiles/code-cli
```

## Notes

- You only need to build these images if you enable Docker sandboxing for the corresponding agent.
- Image tags must match what your agent config references.

