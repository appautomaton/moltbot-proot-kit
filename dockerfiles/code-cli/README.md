# Code CLI sandbox image (Claude Code + Codex + uv)

这个目录提供一个**自定义 Docker sandbox 镜像**，用于 OpenClaw 的 `coder-cli` agent：

- Claude Code CLI（npm 全局安装）
- OpenAI Codex CLI（npm 全局安装）
- `uv/uvx`（用于可控的 Python 环境）
- 常用基础工具（`rg/sed/awk/grep/git/jq/...`）

## 目录结构

- `Dockerfile`：镜像定义
- `config.toml`：Codex CLI 配置（会原样复制到 `/root/.codex/config.toml`）
- `auth.json`：Codex CLI OAuth 缓存（会原样复制到 `/root/.codex/auth.json`）
- `.dockerignore`：默认忽略所有文件，只放行 build 必需文件（避免把杂物带进 build context）

## Build（推荐使用该目录作为 build context）

```sh
docker build \
  -f dockerfiles/code-cli/Dockerfile \
  -t localhost/openclaw-sandbox-code-cli:bookworm-slim \
  dockerfiles/code-cli
```

（你也可以用不带 `:bookworm-slim` 的 tag，但要确保 `openclaw.json` 里 image 名一致。）

## Runtime env（通过 OpenClaw 配置注入）

镜像里不硬编码 token。请在 `bots/openclaw.json` 中给 `coder-cli` 设置：

- `sandbox.docker.env.ANTHROPIC_AUTH_TOKEN`
- `sandbox.docker.env.ANTHROPIC_BASE_URL`（可选：走代理/自定义端点时用）

## OpenClaw agent 配置要点（coder-cli）

为了让 Codex/Claude Code 在容器内正常写入（例如更新配置/缓存），需要关闭只读根文件系统：

```json
{
  "id": "coder-cli",
  "sandbox": {
    "mode": "all",
    "workspaceAccess": "rw",
    "scope": "agent",
    "docker": {
      "image": "localhost/openclaw-sandbox-code-cli:bookworm-slim",
      "network": "bridge",
      "readOnlyRoot": false,
      "env": {
        "ANTHROPIC_AUTH_TOKEN": "${ANTHROPIC_AUTH_TOKEN}",
        "ANTHROPIC_BASE_URL": "${ANTHROPIC_BASE_URL}"
      }
    }
  }
}
```

应用配置后需要重建该 agent 的沙箱容器：

```sh
pnpm openclaw sandbox recreate --agent coder-cli --force
```
