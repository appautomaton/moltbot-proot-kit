ARG UV_IMAGE=ghcr.io/astral-sh/uv:latest
FROM ${UV_IMAGE} AS uv

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Base tooling that Claude Code + typical coding workflows expect.
# Keep this list intentionally "basic but complete" for OOB use in sandboxes.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    coreutils \
    diffutils \
    findutils \
    gawk \
    git \
    grep \
    jq \
    less \
    openssh-client \
    patch \
    python3 \
    python3-venv \
    ripgrep \
    sed \
    tar \
    unzip \
    xz-utils \
    zip \
  && rm -rf /var/lib/apt/lists/*

# Install uv (Python env manager) by copying the official binary (recommended for Docker).
# Docs: https://docs.astral.sh/uv/guides/integration/docker/
COPY --from=uv /uv /uvx /usr/local/bin/
RUN uv --version && uvx --version

# Runtime env (set via OpenClaw `sandbox.docker.env`).
ENV ANTHROPIC_BASE_URL=""
ENV ANTHROPIC_AUTH_TOKEN=""
ENV CODEX_HOME="/root/.codex"

# Claude Code supports auto-updates; sandbox containers often run with read-only rootfs.
# Prefer deterministic updates via image rebuild.
ENV DISABLE_AUTOUPDATER=1

# Install the latest Claude Code CLI (Anthropic).
RUN npm install -g "@anthropic-ai/claude-code@latest" \
  && npm cache clean --force

RUN claude --version

# Install the latest OpenAI Codex CLI.
# Docs: https://developers.openai.com/codex/cli
RUN npm install -g "@openai/codex@latest" \
  && npm cache clean --force

RUN codex --version

RUN mkdir -p /root/.codex
COPY config.toml /root/.codex/config.toml

# User-provided OAuth cache (baked into the image as-is).
# Expected at build time: dockerfiles/code-cli/auth.json
COPY auth.json /root/.codex/auth.json

CMD ["sleep", "infinity"]
