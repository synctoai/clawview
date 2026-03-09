# Agent 会话总览 · ClawView

[中文](#中文) | [English](#english)

## 中文

`ClawView` 是一个用于 OpenClaw 的本地会话可视化工具，可一键启动并在浏览器查看全部 sessions 聊天记录。

### 功能

- 聚合 `~/.openclaw/agents/*/sessions/sessions.json` 会话数据
- 固定看板首页 + 侧栏 session 快速打开弹框
- 会话筛选与跨会话全文检索
- 统计分析：Agent 消息量、活跃时段、Token 趋势、Bot 提及关系图
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
```

### 发布前安全检查

```bash
./scripts/security_scan.sh
```

该脚本会扫描常见密钥模式及高风险文件（如 `.env`、`*.pem`、`*.key`、日志/数据库文件）。

### 本地 API

- `GET /api/health`
- `GET /api/sessions`
- `GET /api/session?key=<session-key>`
- `GET /api/stats`
- `GET /api/search?q=<keywords>&limit=<n>`
- `GET /api/recent?minutes=<n>&sinceMs=<ms>&limit=<n>`
- `GET /api/session/export?key=<session-key>&format=json|md`

---

## English

`ClawView` is a local visualization tool for OpenClaw sessions. Start it with one command and inspect all session chats in your browser.

### Features

- Aggregates data from `~/.openclaw/agents/*/sessions/sessions.json`
- Fixed dashboard layout with sidebar-driven session modal
- Session filter and cross-session full-text search
- Analytics: agent volume, active-hour distribution, token trend, bot mention graph
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
```

### Pre-push Security Check

```bash
./scripts/security_scan.sh
```

The script scans for common secret patterns and risky local files (such as `.env`, `*.pem`, `*.key`, logs, and local DB files).

### Local API

- `GET /api/health`
- `GET /api/sessions`
- `GET /api/session?key=<session-key>`
- `GET /api/stats`
- `GET /api/search?q=<keywords>&limit=<n>`
- `GET /api/recent?minutes=<n>&sinceMs=<ms>&limit=<n>`
- `GET /api/session/export?key=<session-key>&format=json|md`
