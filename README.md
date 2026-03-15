# OpenClaw Agent 会话总览 · ClawView

[中文](#中文) | [English](#english)

## 中文

`ClawView` 是一个用于 OpenClaw 的本地会话可视化工具，可一键启动并在浏览器查看全部 sessions 聊天记录。

![Demo](./assets/Demo.png)

### 功能

- 聚合 `~/.openclaw/agents/*/sessions/sessions.json` 会话数据
- 历史会话自动备份到本地历史仓库，避免 `/new` 后旧会话丢失
- 固定看板首页 + 侧栏 session 快速打开弹框
- 会话按“可用 / 历史”分组展示，支持状态筛选
- 会话筛选与跨会话全文检索
- 统计分析：Agent 消息量、活跃时段、Token 趋势、Bot 提及关系图（总 Sessions/消息/Tokens 默认包含历史会话）
- Session 弹框支持 Markdown 渲染，工具调用/结果弱化并可展开
- 本地中英文切换（默认中文，语言设置会保存在浏览器本地）
- 增量追踪页 `live.html` 实时查看新消息流

### 快速开始（npm）

要求：`Node.js >= 18`、`Python 3`。

```bash
npm i -g clawview
clawview
```

本地开发调试可用：

```bash
cd /path/to/clawview
npm i -g .
```

首次执行 `clawview` 会进入配置向导，支持回车直接使用默认值：

- `host`: `127.0.0.1`
- `port`: `8788`
- `stateDir`: `~/.openclaw`
- `historyRoot`: `~/.clawview`
- `autoOpen`: `true`（启动后自动打开浏览器）

配置文件默认保存到：`~/.clawview/config.json`。

### 一键静默启动

```bash
# 后台静默启动，并按配置自动打开 web 页面
clawview --silent

# 查看状态
clawview --status

# 停止后台进程
clawview --stop
```

后台日志：`~/.clawview/run/clawview.log`。

### 常用参数

```bash
# 重新打开配置向导
clawview --configure

# 临时覆盖端口
clawview --port 8799

# 临时覆盖 OpenClaw 状态目录
clawview --state-dir /path/to/.openclaw

# 临时覆盖历史根目录
clawview --history-root /path/to/history-root

# 启动时不自动打开浏览器
clawview --no-open

# 打印当前生效配置
clawview --print-config

# 非交互配置（持久化写入 ~/.clawview/config.json）
clawview config set --port 9000
clawview config set --state-dir /path/to/.openclaw --history-root /path/to/history-root
clawview config set --auto-open false
clawview config get port
clawview config show
clawview config reset
```

### 兼容原启动方式

```bash
./start.sh
```

### 历史备份目录结构

默认历史根目录是 `~/.clawview`，实际数据会写到：

- `~/.clawview/history/v1/index.json`：历史索引（会话状态、活动槽位、元信息）
- `~/.clawview/history/v1/sessions/<hash-prefix>/<session-id>/events.jsonl`：会话事件镜像

说明：

- 使用 `Path`/`expanduser`/`resolve` 做路径处理，兼容 macOS / Linux / Windows。
- 会话目录使用哈希 ID，避免 Windows 下 `:` 等非法文件名字符问题。
- 每次刷新会把当前活动会话同步到历史仓库；当会话被 `/new` 轮转或从活动列表消失时，旧会话自动标记为历史并保留。

### 发布前安全检查

```bash
# npm 发布前检查（版本、打包内容、Node/Python 依赖、CLI 冒烟）
npm run publish:check

# 安全扫描（密钥/高风险文件）
./scripts/security_scan.sh
```

该脚本会扫描常见密钥模式及高风险文件（如 `.env`、`*.pem`、`*.key`、日志/数据库文件）。

### 本地 API

- `GET /api/health`
- `GET /api/sessions`
- `GET /api/session?id=<session-uid>` (兼容 `key`)
- `GET /api/stats`
- `GET /api/search?q=<keywords>&limit=<n>`
- `GET /api/recent?minutes=<n>&sinceMs=<ms>&limit=<n>`
- `GET /api/session/export?id=<session-uid>&format=json|md` (兼容 `key`)

---

## English

`ClawView` is a local visualization tool for OpenClaw sessions. Start it with one command and inspect all session chats in your browser.

### Features

- Aggregates data from `~/.openclaw/agents/*/sessions/sessions.json`
- Automatically backs up historical sessions locally so `/new` does not erase previous conversations
- Fixed dashboard layout with sidebar-driven session modal
- Sessions are grouped by Active / Archived and support status filtering
- Session filter and cross-session full-text search
- Analytics: agent volume, active-hour distribution, token trend, bot mention graph (totals include active + historical sessions)
- Session modal with Markdown rendering and collapsible tool call/result blocks
- Local bilingual UI (Chinese by default, language preference persisted in browser)
- Live stream page at `live.html` for incremental message tracking

### Quick Start (npm)

Requirements: `Node.js >= 18`, `Python 3`.

```bash
npm i -g clawview
clawview
```

For local development:

```bash
cd /path/to/clawview
npm i -g .
```

On first run, `clawview` starts an interactive setup wizard. Press Enter to accept defaults:

- `host`: `127.0.0.1`
- `port`: `8788`
- `stateDir`: `~/.openclaw`
- `historyRoot`: `~/.clawview`
- `autoOpen`: `true` (open browser on startup)

Default config path: `~/.clawview/config.json`.

### One-Command Silent Start

```bash
# Start in background and open the web page
clawview --silent

# Check status
clawview --status

# Stop background process
clawview --stop
```

Background log: `~/.clawview/run/clawview.log`.

### Common Options

```bash
# Re-run setup wizard
clawview --configure

# Override port for current launch only
clawview --port 8799

# Override OpenClaw state dir for current launch
clawview --state-dir /path/to/.openclaw

# Override history root for current launch
clawview --history-root /path/to/history-root

# Disable browser open on startup
clawview --no-open

# Print effective config
clawview --print-config

# Non-interactive persisted config updates (~/.clawview/config.json)
clawview config set --port 9000
clawview config set --state-dir /path/to/.openclaw --history-root /path/to/history-root
clawview config set --auto-open false
clawview config get port
clawview config show
clawview config reset
```

### Legacy Start Script

```bash
./start.sh
```

### History Storage Layout

Default history root is `~/.clawview`; data is written to:

- `~/.clawview/history/v1/index.json`: history index (session status, active slots, metadata)
- `~/.clawview/history/v1/sessions/<hash-prefix>/<session-id>/events.jsonl`: mirrored session events

Notes:

- Path handling uses `Path`/`expanduser`/`resolve` for macOS, Linux, and Windows compatibility.
- Session directories are hash-based to avoid illegal filename characters on Windows.
- Active sessions are synced continuously; when a session rotates (for example by `/new`) or disappears from active slots, it is retained as archived history.

### Pre-push Security Check

```bash
# Pre-publish checks (version, pack content, Node/Python runtime, CLI smoke)
npm run publish:check

# Security scan (secrets / risky local files)
./scripts/security_scan.sh
```

The script scans for common secret patterns and risky local files (such as `.env`, `*.pem`, `*.key`, logs, and local DB files).

### Local API

- `GET /api/health`
- `GET /api/sessions`
- `GET /api/session?id=<session-uid>` (also supports `key`)
- `GET /api/stats`
- `GET /api/search?q=<keywords>&limit=<n>`
- `GET /api/recent?minutes=<n>&sinceMs=<ms>&limit=<n>`
- `GET /api/session/export?id=<session-uid>&format=json|md` (also supports `key`)
