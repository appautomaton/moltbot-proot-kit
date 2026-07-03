# gog（gogcli）认证说明（Gmail / Calendar）

这份文档只讲两件事：
1) `gog` 的 OAuth/Keyring 怎么配，才能在 **非交互**（`--no-input` / Gateway / skill）场景稳定跑  
2) 本仓库如何用一个 wrapper 在运行 Gateway 时自动注入必需环境变量

---

## 背景：为什么会“手动能跑，agent 跑不了”

`gog` 需要能读取 refresh token。常见两种存储方式：

```
OS Keyring（桌面环境）
  gog -> DBus/Keychain -> token

加密文件 keyring（无桌面/daemon/CI 最稳）
  gog -> bots/gogcli/keyring/* (encrypted)  -> token
            ^ 需要 GOG_KEYRING_PASSWORD 解锁
```

当你在终端里手动跑，`gog` 可以弹出提示让你输入 keyring passphrase；  
但 Gateway/skill 往往是 **无 TTY** + `--no-input`，它没法提示你输入，于是必须靠环境变量提供密码。

---

## 推荐目录（dev）

本仓库默认把 dev 配置集中在 repo-local `bots/`：

- OAuth client secret（你从 Google Cloud Console 下载的 JSON）：
  - `bots/.secrets/gog/client_secret.json`
- keyring passphrase（你自己设置的一段口令；不要提交到 git）：
  - `bots/.secrets/gog/keyring.pass`
- gogcli 配置与 token（自动生成）：
  - `bots/gogcli/credentials.json`
  - `bots/gogcli/keyring/*`

建议权限：
- `chmod 700 bots/.secrets`
- `chmod 600 bots/.secrets/gog/keyring.pass`

---

## 认证配置（一步一步）

### 0) 统一环境变量（很重要）

以后你在终端里执行任何 `gog ...`，都建议先确保它写进 **同一套 dev 配置目录**：

```bash
export XDG_CONFIG_HOME="$PWD/bots"
export GOG_KEYRING_PASSWORD="$(cat "$PWD/bots/.secrets/gog/keyring.pass")"
```

> 注意：如果你不设 `XDG_CONFIG_HOME`，`gog` 默认会写到 `~/.config/gogcli`，导致“我明明授权了，但 Gateway 找不到/用不了”。

### 1) 存 OAuth 客户端凭据

```bash
gog auth credentials set "$PWD/bots/.secrets/gog/client_secret.json"
gog auth credentials list --plain
```

### 2) 进行授权（拿 refresh token）

同时要用 Gmail + Calendar：

```bash
gog auth add you@example.com --services gmail,calendar --force-consent
gog auth list --plain --no-input
```

如果你看到类似 `403 access_denied`（测试中 app 只允许 tester），去 Google OAuth consent screen 的 **Test users** 把你的邮箱加进去。

---

## 常见报错速查

### A) `no TTY available ... set GOG_KEYRING_PASSWORD`

说明：你在非交互环境跑 `gog`，但没给 `GOG_KEYRING_PASSWORD`。  
解决：把上面的两条 `export ...` 放到启动 Gateway 的环境里（见下文 wrapper）。

### B) `403 accessNotConfigured`

说明：对应的 Google API 没启用（例如 Calendar/Gmail）。  
解决：在同一个 GCP Project 里启用：
- `Google Calendar API (calendar-json.googleapis.com)`
- `Gmail API (gmail.googleapis.com)`

### C) `403 insufficientPermissions`（scope 不够）

说明：你当前 token 没包含 Gmail/Calendar 的 scopes。  
解决：在 **同一套 `XDG_CONFIG_HOME`** 下重新 `auth add`，并带 `--force-consent` 让 Google 重新出同意页。

---

## 本仓库的 Gateway env wrapper（避免每次手打一长串）

### 目标

让你照旧运行：
- `pnpm openclaw gateway`

把这些环境变量写进 `config/.env`，Gateway 进程就会从 wrapper 继承：
- `XDG_CONFIG_HOME=/absolute/path/to/this/repo/bots`
- `GOG_KEYRING_PASSWORD=...`
- `PATH` 中包含能找到 `gog` 的目录

### 实现位置

- Wrapper 脚本：`scripts/openclaw.mjs`
- pnpm 脚本入口：`package.json` 里的 `"openclaw": "node scripts/openclaw.mjs"`

### 行为说明（简化版）

```
pnpm openclaw gateway
  -> node scripts/openclaw.mjs
     -> loads config/.env
     -> spawn: pnpm --dir openclaw openclaw gateway ...
        -> Gateway exec tools (gog --no-input ...) 继承到 env
```

额外：wrapper 也会把误写的 `gateway --dev` 自动规整为 `--dev gateway`，避免 CLI 解析报错。
