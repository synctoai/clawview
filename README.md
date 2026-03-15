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

### 快速开始

```bash
cd /Users/leeeeeee/.openclaw/workspace-discord/projects/clawview
chmod +x start.sh
./start.sh
```

默认打开：`http://127.0.0.1:8788`

### 可选参数

```bash
# 自定义端口
./start.sh 8799

# 自定义 OpenClaw 状态目录
OPENCLAW_STATE_DIR=/path/to/.openclaw ./start.sh

# 自定义历史备份根目录（默认: ~/.clawview）
CLAWVIEW_HISTORY_DIR=/path/to/history-root ./start.sh

# 兼容旧变量名
CLAWVIEW_BACKUP_DIR=/path/to/history-root ./start.sh

# 或直接传启动参数
python3 app.py --state-dir /path/to/.openclaw --history-root /path/to/history-root --port 8788 --open
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

### Quick Start

```bash
cd /Users/leeeeeee/.openclaw/workspace-discord/projects/clawview
chmod +x start.sh
./start.sh
```

Default URL: `http://127.0.0.1:8788`

### Optional Parameters

```bash
# Custom port
./start.sh 8799

# Custom OpenClaw state directory
OPENCLAW_STATE_DIR=/path/to/.openclaw ./start.sh

# Custom history backup root (default: ~/.clawview)
CLAWVIEW_HISTORY_DIR=/path/to/history-root ./start.sh

# Backward-compatible env name
CLAWVIEW_BACKUP_DIR=/path/to/history-root ./start.sh

# Or pass CLI args directly
python3 app.py --state-dir /path/to/.openclaw --history-root /path/to/history-root --port 8788 --open
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
