const state = {
  lang: "zh-CN",
  sessions: [],
  selectedKey: null,
  selectedUpdatedAt: 0,
  updatedKeys: new Set(),
  messageIdSets: new Map(),
  newMessageIds: new Set(),
  jumpMessageId: null,
  autoTimer: null,
  refreshing: false,
  searchResults: [],
  mentionNodes: [],
  mentionEdges: [],
  mentionNodePos: {},
  mentionSelectedEdgeKey: null,
  mentionSelectedNodeId: null,
  mentionDraggingNodeId: null,
  mentionDragMoved: false,
  mentionDragStartX: 0,
  mentionDragStartY: 0,
  mentionRafPending: false,
  mentionDragRafPending: false,
  mentionDragNodeUpdateId: null,
  mentionNodeLookup: new Map(),
  mentionNodeRefs: new Map(),
  mentionEdgeRefs: new Map(),
  mentionNodeToEdges: new Map(),
  modalOpen: false,
  searchModalOpen: false,
  currentSessionPayload: null,
  stateDirPath: "",
  lastStats: null,
  searchQuery: "",
  searchDebounceTimer: null,
  messageView: {
    onlyDialogue: true,
    showTools: true,
    showMeta: true,
  },
};

const el = {
  stateDir: document.getElementById("state-dir"),
  langSelect: document.getElementById("lang-select"),
  searchInput: document.getElementById("search-input"),
  agentFilter: document.getElementById("agent-filter"),
  autoRefresh: document.getElementById("auto-refresh"),
  refreshInterval: document.getElementById("refresh-interval"),
  globalSearchOpenBtn: document.getElementById("global-search-open-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  sessionCount: document.getElementById("session-count"),
  sessionList: document.getElementById("session-list"),
  sessionModal: document.getElementById("session-modal"),
  sessionModalClose: document.getElementById("session-modal-close"),
  sessionModalMeta: document.getElementById("session-modal-meta"),
  sessionModalMessages: document.getElementById("session-modal-messages"),
  viewOnlyDialogue: document.getElementById("view-only-dialogue"),
  viewShowTools: document.getElementById("view-show-tools"),
  viewShowMeta: document.getElementById("view-show-meta"),
  exportJsonBtn: document.getElementById("export-json-btn"),
  exportMdBtn: document.getElementById("export-md-btn"),
  searchModal: document.getElementById("search-modal"),
  searchModalClose: document.getElementById("search-modal-close"),
  totalSessions: document.getElementById("total-sessions"),
  totalMessages: document.getElementById("total-messages"),
  totalTokens: document.getElementById("total-tokens"),
  activeRange: document.getElementById("active-range"),
  agentBars: document.getElementById("agent-bars"),
  hourBars: document.getElementById("hour-bars"),
  tokenTrend: document.getElementById("token-trend"),
  trendLabels: document.getElementById("trend-labels"),
  trendMetrics: document.getElementById("trend-metrics"),
  mentionNetwork: document.getElementById("mention-network"),
  mentionDetails: document.getElementById("mention-details"),
  globalSearchInput: document.getElementById("global-search-input"),
  globalSearchBtn: document.getElementById("global-search-btn"),
  globalSearchClearBtn: document.getElementById("global-search-clear-btn"),
  searchResultCount: document.getElementById("search-result-count"),
  searchResults: document.getElementById("search-results"),
};

const DEFAULT_LANG = "zh-CN";
const LANGUAGE_STORAGE_KEY = "clawview_lang";
const I18N = {
  "zh-CN": {
    "page.title": "OpenClaw Agent 会话总览 · ClawView",
    "header.title": "OpenClaw Agent 会话总览",
    "state.loading": "加载中...",
    "search.placeholder": "过滤 session key / channel / model",
    "agents.all": "全部 agents",
    "auto.refresh": "自动刷新",
    "refresh.interval.title": "刷新间隔",
    "language.select.title": "语言 / Language",
    "language.zh": "中文",
    "language.en": "English",
    "button.global.search": "全文检索",
    "menu.more": "更多",
    "button.refresh.now": "立即刷新",
    "button.export.json": "导出 JSON",
    "button.export.md": "导出 Markdown",
    "button.close": "关闭",
    "button.search": "搜索",
    "button.clear": "清空",
    "link.live.view": "增量追踪",
    "panel.sessions": "Sessions",
    "stats.total.sessions": "总 Sessions",
    "stats.total.messages": "总消息数",
    "stats.total.tokens": "总 Tokens",
    "stats.active.range": "活跃区间",
    "viz.agent.messages": "Agent 消息量",
    "viz.active.hours": "活跃时段 (0-23h)",
    "viz.token.trend": "Token 趋势",
    "viz.mention.graph": "Bot 提及关系图 (可拖拽/点击)",
    "session.modal.aria": "Session Chat Viewer",
    "session.modal.placeholder": "选择左侧一个 session 查看聊天记录",
    "view.only.dialogue": "仅看对话",
    "view.show.tools": "显示工具",
    "view.show.meta": "显示元信息",
    "search.modal.aria": "Global Search",
    "search.modal.title": "跨会话全文检索",
    "search.global.placeholder": "输入关键词，例如: pmbot 需求评审",
    "search.result.count.label.prefix": "结果数:",
    "common.empty": "(空)",
    "common.unknown": "unknown",
    "common.session": "session",
    "common.tool": "tool",
    "tool.summary.calls": "调用 {summary}",
    "tool.summary.results": "结果 {count} 条",
    "tool.result": "结果",
    "tool.call.noargs": "无调用参数",
    "tool.activity.default": "工具调用",
    "tool.activity.expand": "展开工具细节",
    "message.meta.summary": "消息详情 · 元信息 {count} 项",
    "message.meta.title": "metadata",
    "message.body.collapsed.tools": "（正文已折叠，仅展示工具摘要）",
    "message.body.empty.meta": "（正文为空，请展开下方消息详情）",
    "message.body.meta.hidden": "（该消息仅包含元信息，当前已隐藏）",
    "session.empty.filtered": "没有匹配的 session",
    "session.meta.agent": "agent",
    "session.meta.model": "model",
    "session.meta.updated": "updated",
    "session.meta.messages": "messages",
    "session.meta.assistant": "assistant",
    "session.meta.user": "user",
    "session.empty.no_messages": "该 session 暂无可展示消息",
    "session.empty.no_visible": "当前筛选条件下暂无可展示消息",
    "session.loading": "加载中...",
    "session.load.failed": "加载失败: {error}",
    "sessions.fetch.failed": "sessions 拉取失败",
    "sessions.none.readable": "当前没有可读取的 sessions",
    "data.none": "暂无数据",
    "trend.peak": "峰值 {tokens} @ {date}",
    "trend.latest": "最新",
    "trend.avg": "均值",
    "trend.change": "变化",
    "trend.direction": "趋势",
    "trend.up": "上升",
    "trend.down": "下降",
    "trend.flat": "持平",
    "range.from": "起",
    "range.to": "止",
    "search.empty.results": "暂无搜索结果",
    "search.empty.prompt": "输入关键词开始检索",
    "search.loading": "检索中...",
    "search.failed": "搜索失败: {error}",
    "mention.empty.data": "暂无 bot 提及数据",
    "mention.count": "提及 {count} 次",
    "mention.samples": "样本 {count} 条",
    "mention.tip": "提示：点击样本可直接跳转消息。拖拽节点只改变布局，不影响数据。",
    "mention.empty.samples": "暂无提及样本",
    "mention.samples.hidden": "其余 {count} 条样本已折叠，可用“全文检索”查看。",
    "session.badge.new": "NEW",
  },
  "en-US": {
    "page.title": "OpenClaw Agent Session Overview · ClawView",
    "header.title": "OpenClaw Agent Session Overview",
    "state.loading": "Loading...",
    "search.placeholder": "Filter by session key / channel / model",
    "agents.all": "All agents",
    "auto.refresh": "Auto refresh",
    "refresh.interval.title": "Refresh interval",
    "language.select.title": "Language / 语言",
    "language.zh": "中文",
    "language.en": "English",
    "button.global.search": "Global Search",
    "menu.more": "More",
    "button.refresh.now": "Refresh",
    "button.export.json": "Export JSON",
    "button.export.md": "Export Markdown",
    "button.close": "Close",
    "button.search": "Search",
    "button.clear": "Clear",
    "link.live.view": "Live Stream",
    "panel.sessions": "Sessions",
    "stats.total.sessions": "Total Sessions",
    "stats.total.messages": "Total Messages",
    "stats.total.tokens": "Total Tokens",
    "stats.active.range": "Active Range",
    "viz.agent.messages": "Agent Message Volume",
    "viz.active.hours": "Active Hours (0-23h)",
    "viz.token.trend": "Token Trend",
    "viz.mention.graph": "Bot Mention Graph (drag/click)",
    "session.modal.aria": "Session Chat Viewer",
    "session.modal.placeholder": "Select a session on the left to view messages",
    "view.only.dialogue": "Dialogue only",
    "view.show.tools": "Show tools",
    "view.show.meta": "Show metadata",
    "search.modal.aria": "Global Search",
    "search.modal.title": "Cross-session Full-text Search",
    "search.global.placeholder": "Enter keywords, e.g. pmbot requirement review",
    "search.result.count.label.prefix": "Results:",
    "common.empty": "(empty)",
    "common.unknown": "unknown",
    "common.session": "session",
    "common.tool": "tool",
    "tool.summary.calls": "Calls {summary}",
    "tool.summary.results": "{count} result(s)",
    "tool.result": "Result",
    "tool.call.noargs": "No call arguments",
    "tool.activity.default": "Tool activity",
    "tool.activity.expand": "Expand tool details",
    "message.meta.summary": "Message details · metadata {count}",
    "message.meta.title": "metadata",
    "message.body.collapsed.tools": "(Message body collapsed, tool summary shown only)",
    "message.body.empty.meta": "(Message body is empty, expand details below)",
    "message.body.meta.hidden": "(This message contains metadata only and is hidden)",
    "session.empty.filtered": "No matching sessions",
    "session.meta.agent": "agent",
    "session.meta.model": "model",
    "session.meta.updated": "updated",
    "session.meta.messages": "messages",
    "session.meta.assistant": "assistant",
    "session.meta.user": "user",
    "session.empty.no_messages": "No messages in this session",
    "session.empty.no_visible": "No visible messages under current filters",
    "session.loading": "Loading...",
    "session.load.failed": "Load failed: {error}",
    "sessions.fetch.failed": "Failed to fetch sessions",
    "sessions.none.readable": "No readable sessions found",
    "data.none": "No data",
    "trend.peak": "Peak {tokens} @ {date}",
    "trend.latest": "Latest",
    "trend.avg": "Average",
    "trend.change": "Change",
    "trend.direction": "Direction",
    "trend.up": "Up",
    "trend.down": "Down",
    "trend.flat": "Flat",
    "range.from": "From",
    "range.to": "To",
    "search.empty.results": "No search results",
    "search.empty.prompt": "Enter keywords to start searching",
    "search.loading": "Searching...",
    "search.failed": "Search failed: {error}",
    "mention.empty.data": "No bot mention data",
    "mention.count": "{count} mentions",
    "mention.samples": "{count} samples",
    "mention.tip": "Tip: click a sample to jump to the message. Dragging only changes layout.",
    "mention.empty.samples": "No mention samples",
    "mention.samples.hidden": "{count} sample(s) are collapsed. Use Global Search for more.",
    "session.badge.new": "NEW",
  },
};

function t(key, vars = {}) {
  const dict = I18N[state.lang] || I18N[DEFAULT_LANG];
  const fallback = I18N[DEFAULT_LANG];
  let template = dict[key] ?? fallback[key] ?? key;
  Object.entries(vars).forEach(([name, value]) => {
    template = template.replaceAll(`{${name}}`, String(value ?? ""));
  });
  return template;
}

function applyI18nToDom() {
  document.documentElement.lang = state.lang === "en-US" ? "en" : "zh-CN";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) return;
    node.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (!key) return;
    node.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const key = node.getAttribute("data-i18n-title");
    if (!key) return;
    node.setAttribute("title", t(key));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria-label");
    if (!key) return;
    node.setAttribute("aria-label", t(key));
  });
  document.title = t("page.title");
}

function setLanguage(lang, options = { persist: true }) {
  const nextLang = I18N[lang] ? lang : DEFAULT_LANG;
  state.lang = nextLang;
  if (el.langSelect) {
    el.langSelect.value = nextLang;
  }
  if (options.persist) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
  }
  applyI18nToDom();
  if (state.stateDirPath) {
    el.stateDir.textContent = state.stateDirPath;
  }
  renderAgentFilter();
  renderSessions();
  rerenderCurrentSession();
  renderSearchResults();
  if (state.lastStats) {
    renderStats(state.lastStats);
  }
}

function initLanguage() {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const initial = saved && I18N[saved] ? saved : DEFAULT_LANG;
  setLanguage(initial, { persist: false });
}

function escapeHtml(input) {
  const text = String(input ?? "");
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(state.lang);
}

function fmtDateCompact(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(state.lang, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtNumber(value) {
  return Number(value || 0).toLocaleString(state.lang);
}

function roleClass(role) {
  if (role === "user") return "role-user";
  if (role === "assistant") return "role-assistant";
  if (role === "toolResult") return "role-tool";
  return "role-other";
}

function safeLinkUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    return "";
  }
  return "";
}

function applyInlineMarkdown(escapedText) {
  let text = escapedText;
  const codeTokens = [];

  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const token = `@@INLINECODE${codeTokens.length}@@`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const safeUrl = safeLinkUrl(url);
    if (!safeUrl) return label;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${label}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  text = text.replace(/@@INLINECODE(\d+)@@/g, (_, idx) => codeTokens[Number(idx)] || "");
  return text;
}

function markdownToHtml(input) {
  const source = String(input || "").replace(/\r\n/g, "\n");
  if (!source.trim()) return `<p>${escapeHtml(t("common.empty"))}</p>`;

  const codeBlocks = [];
  let text = source.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const token = `@@CODEBLOCK${codeBlocks.length}@@`;
    codeBlocks.push({
      lang: (lang || "").trim(),
      code: String(code || "").replace(/\n$/, ""),
    });
    return token;
  });

  text = escapeHtml(text);
  const lines = text.split("\n");

  const isCodeTokenLine = (line) => /^@@CODEBLOCK\d+@@$/.test(line.trim());
  const isHeading = (line) => /^(#{1,6})\s+/.test(line.trim());
  const isQuote = (line) => /^\s*&gt;\s?/.test(line);
  const isUnordered = (line) => /^\s*[-*+]\s+/.test(line);
  const isOrdered = (line) => /^\s*\d+\.\s+/.test(line);
  const isSpecial = (line) =>
    isCodeTokenLine(line) || isHeading(line) || isQuote(line) || isUnordered(line) || isOrdered(line);

  const html = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const codeToken = line.trim().match(/^@@CODEBLOCK(\d+)@@$/);
    if (codeToken) {
      const block = codeBlocks[Number(codeToken[1])] || { lang: "", code: "" };
      const langClass = block.lang ? ` class="language-${escapeHtml(block.lang)}"` : "";
      html.push(`<pre><code${langClass}>${escapeHtml(block.code)}</code></pre>`);
      i += 1;
      continue;
    }

    const heading = line.trim().match(/^(#{1,6})\s+([\s\S]+)$/);
    if (heading) {
      const level = heading[1].length;
      const body = applyInlineMarkdown(heading[2].trim());
      html.push(`<h${level}>${body}</h${level}>`);
      i += 1;
      continue;
    }

    if (isQuote(line)) {
      const quoteLines = [];
      while (i < lines.length && isQuote(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*&gt;\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${applyInlineMarkdown(quoteLines.join("<br />"))}</blockquote>`);
      continue;
    }

    if (isUnordered(line)) {
      const items = [];
      while (i < lines.length && isUnordered(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (isOrdered(line)) {
      const items = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${applyInlineMarkdown(para.join("<br />"))}</p>`);
  }

  return html.join("");
}

function renderMarkdownBlock(text) {
  return `<div class="md-body">${markdownToHtml(text)}</div>`;
}

function splitUntrustedMetadata(text) {
  const blocks = [];
  const pattern =
    /(Conversation info \(untrusted metadata\)|Sender \(untrusted metadata\)):\s*```(?:json)?\n([\s\S]*?)```/gi;
  const cleaned = String(text || "").replace(pattern, (_, title, body) => {
    blocks.push({
      title: title || t("message.meta.title"),
      body: (body || "").trim(),
    });
    return "";
  });
  return { cleaned: cleaned.trim(), blocks };
}

function extractToolResultContent(result) {
  return (
    (Array.isArray(result.parts) && result.parts.length
      ? result.parts
          .map((part) => {
            if (part?.type === "text") return String(part.text || "");
            if (part?.type === "tool_result") return String(part.detail || "");
            return "";
          })
          .filter(Boolean)
          .join("\n\n")
      : String(result.text || "")) || t("common.empty")
  );
}

function extractToolResultLabel(result, fallback = "tool") {
  if (!Array.isArray(result.parts)) return fallback;
  const part = result.parts.find((x) => x?.type === "tool_result");
  return part?.toolLabel || part?.tool || fallback;
}

function collectMessageViewData(msg) {
  const rawParts = Array.isArray(msg.parts) && msg.parts.length ? msg.parts : [{ type: "text", text: msg.text || "" }];
  const textChunks = [];
  const metadataBlocks = [];
  const toolCalls = [];
  const toolResults = [];
  let hasThinking = false;

  rawParts.forEach((part) => {
    const partType = part?.type || "text";
    if (partType === "text") {
      const text = String(part.text || "").trim();
      if (!text) return;
      if (msg.role === "user") {
        const split = splitUntrustedMetadata(text);
        if (split.cleaned) {
          textChunks.push(split.cleaned);
        }
        if (split.blocks.length) {
          metadataBlocks.push(...split.blocks);
        }
        return;
      }
      textChunks.push(text);
      return;
    }

    if (partType === "tool_call") {
      toolCalls.push({
        label: String(part.toolLabel || part.tool || t("common.tool")),
        detail: String(part.detail || "").trim() || t("common.empty"),
      });
      return;
    }

    if (partType === "tool_result") {
      toolResults.push({
        label: String(part.toolLabel || part.tool || t("common.tool")),
        detail: String(part.detail || "").trim() || t("common.empty"),
        timestamp: msg.timestamp,
      });
      return;
    }

    if (partType === "thinking") {
      hasThinking = true;
    }
  });

  const linked = Array.isArray(msg.linkedResults) ? msg.linkedResults : [];
  const fallbackLabel =
    (toolCalls.length ? toolCalls[toolCalls.length - 1].label : "") ||
    (toolResults.length ? toolResults[toolResults.length - 1].label : "") ||
    t("common.tool");
  linked.forEach((result) => {
    toolResults.push({
      label: String(extractToolResultLabel(result, fallbackLabel) || fallbackLabel),
      detail: String(extractToolResultContent(result) || t("common.empty")),
      timestamp: result.timestamp,
    });
  });

  return {
    textChunks,
    metadataBlocks,
    toolCalls,
    toolResults,
    hasThinking,
  };
}

function buildToolSummary(toolCalls, toolResults) {
  const counts = new Map();
  toolCalls.forEach((call) => {
    const label = String(call.label || "tool");
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const callSummary = [...counts.entries()].map(([label, count]) => `${label} x${count}`);
  const parts = [];
  if (callSummary.length) {
    parts.push(t("tool.summary.calls", { summary: callSummary.join(" · ") }));
  }
  if (toolResults.length) {
    parts.push(t("tool.summary.results", { count: toolResults.length }));
  }
  return parts.join(" · ");
}

function buildDetailPreview(text, maxLen = 88) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (!compact) return t("common.empty");
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen).trimEnd()}...`;
}

function renderToolActivity(msgData) {
  if (!msgData.toolCalls.length && !msgData.toolResults.length) return "";
  const summaryText = buildToolSummary(msgData.toolCalls, msgData.toolResults);

  const steps = [];
  const maxLen = Math.max(msgData.toolCalls.length, msgData.toolResults.length);
  for (let i = 0; i < maxLen; i += 1) {
    const call = msgData.toolCalls[i] || null;
    const result = msgData.toolResults[i] || null;
    const label = (call?.label || result?.label || t("common.tool")).trim() || t("common.tool");
    const resultDetail = String(result?.detail || "");
    const preview = buildDetailPreview(resultDetail, 68);
    const statText = result ? `${resultDetail.length} chars` : "";
    steps.push(`
      <section class="tool-step">
        <div class="tool-step-head">
          <span class="tool-badge">${escapeHtml(label)}</span>
          <span>#${i + 1}</span>
        </div>
        ${
          call
            ? `<pre>${escapeHtml(call.detail || t("common.empty"))}</pre>`
            : `<p class="msg-muted">${escapeHtml(t("tool.call.noargs"))}</p>`
        }
        ${
          result
            ? `
              <details class="tool-result-brief">
                <summary>
                  <span>${escapeHtml(t("tool.result"))}</span>
                  <span>${escapeHtml(preview)}</span>
                  <span>${escapeHtml(statText)}</span>
                  <span>${result.timestamp ? escapeHtml(fmtDate(result.timestamp)) : ""}</span>
                </summary>
                <pre>${escapeHtml(result.detail || t("common.empty"))}</pre>
              </details>
            `
            : ""
        }
      </section>
    `);
  }

  return `
    <div class="tool-summary-row">${escapeHtml(summaryText || t("tool.activity.default"))}</div>
    <details class="tool-activity-details">
      <summary>${escapeHtml(t("tool.activity.expand"))}</summary>
      <div class="tool-step-list">${steps.join("")}</div>
    </details>
  `;
}

function renderMetadataDrawer(blocks) {
  if (!blocks.length) return "";
  return `
    <details class="msg-meta-drawer">
      <summary>${escapeHtml(t("message.meta.summary", { count: blocks.length }))}</summary>
      <div class="meta-details-body">
        ${blocks
          .map(
            (block) => `
          <section class="meta-block">
            <h4>${escapeHtml(block.title)}</h4>
            <pre>${escapeHtml(block.body || t("common.empty"))}</pre>
          </section>
        `
          )
          .join("")}
      </div>
    </details>
  `;
}

function renderMessageBody(msg, view, viewOptions) {
  const chunks = [];
  const options = viewOptions || state.messageView;
  const effectiveShowTools = options.showTools && !options.onlyDialogue;
  const effectiveShowMeta = options.showMeta && !options.onlyDialogue;

  if (view.textChunks.length) {
    chunks.push(renderMarkdownBlock(view.textChunks.join("\n\n")));
  } else if (effectiveShowTools && msg.role === "assistant" && (view.toolCalls.length || view.toolResults.length)) {
    chunks.push(`<p class="msg-muted">${escapeHtml(t("message.body.collapsed.tools"))}</p>`);
  } else if (view.metadataBlocks.length && effectiveShowMeta) {
    chunks.push(`<p class="msg-muted">${escapeHtml(t("message.body.empty.meta"))}</p>`);
  } else if (view.metadataBlocks.length && !effectiveShowMeta) {
    chunks.push(`<p class="msg-muted">${escapeHtml(t("message.body.meta.hidden"))}</p>`);
  } else if (view.hasThinking) {
    chunks.push('<p class="thinking-muted">(thinking omitted)</p>');
  } else {
    chunks.push(renderMarkdownBlock(t("common.empty")));
  }

  if (effectiveShowTools && msg.role === "assistant") {
    chunks.push(renderToolActivity(view));
  } else if (effectiveShowTools && (view.toolCalls.length || view.toolResults.length)) {
    chunks.push(renderToolActivity(view));
  }

  const metaDrawer = effectiveShowMeta ? renderMetadataDrawer(view.metadataBlocks) : "";
  if (metaDrawer && effectiveShowMeta) {
    chunks.push(metaDrawer);
  }

  return chunks.join("");
}

function dayKeyFromTimestamp(value) {
  const d = new Date(value || 0);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabelFromTimestamp(value) {
  const d = new Date(value || 0);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(state.lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function hasDialogueText(view) {
  return view.textChunks.some((text) => String(text || "").trim().length > 0);
}

function getVisibleRows(displayRows, viewCache) {
  if (!state.messageView.onlyDialogue) {
    return displayRows;
  }
  return displayRows.filter((msg) => {
    if (msg.role === "toolResult") return false;
    const view = viewCache.get(msg);
    if (!view) return true;
    return hasDialogueText(view);
  });
}

function setToggleEnabled(input, enabled) {
  if (!input) return;
  input.disabled = !enabled;
  const label = input.closest("label");
  if (label) {
    label.classList.toggle("disabled", !enabled);
  }
}

function syncMessageViewControls() {
  if (!el.viewOnlyDialogue || !el.viewShowTools || !el.viewShowMeta) return;
  el.viewOnlyDialogue.checked = !!state.messageView.onlyDialogue;
  el.viewShowTools.checked = !!state.messageView.showTools;
  el.viewShowMeta.checked = !!state.messageView.showMeta;

  const enableTools = !state.messageView.onlyDialogue;
  const enableMeta = !state.messageView.onlyDialogue;
  setToggleEnabled(el.viewShowTools, enableTools);
  setToggleEnabled(el.viewShowMeta, enableMeta);
}

function rerenderCurrentSession() {
  if (!state.currentSessionPayload) return;
  renderMessages(state.currentSessionPayload, null);
}

function groupMessagesForDisplay(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const msg = rows[i];
    const hasToolCall =
      msg.role === "assistant" &&
      Array.isArray(msg.parts) &&
      msg.parts.some((part) => part?.type === "tool_call");
    if (!hasToolCall) {
      out.push(msg);
      continue;
    }

    const linkedResults = [];
    let j = i + 1;
    while (j < rows.length && rows[j]?.role === "toolResult") {
      linkedResults.push(rows[j]);
      j += 1;
    }

    out.push({ ...msg, linkedResults });
    i = j - 1;
  }
  return out;
}

function openSessionModal() {
  if (state.modalOpen) return;
  state.modalOpen = true;
  el.sessionModal.classList.add("open");
  el.sessionModal.setAttribute("aria-hidden", "false");
  syncModalBodyState();
}

function closeSessionModal() {
  if (!state.modalOpen) return;
  state.modalOpen = false;
  el.sessionModal.classList.remove("open");
  el.sessionModal.setAttribute("aria-hidden", "true");
  syncModalBodyState();
}

function syncModalBodyState() {
  const hasOpenModal = state.modalOpen || state.searchModalOpen;
  document.body.classList.toggle("modal-open", hasOpenModal);
}

function openSearchModal() {
  if (state.searchModalOpen) return;
  state.searchModalOpen = true;
  el.searchModal.classList.add("open");
  el.searchModal.setAttribute("aria-hidden", "false");
  syncModalBodyState();
  setTimeout(() => {
    el.globalSearchInput?.focus();
    el.globalSearchInput?.select();
  }, 30);
}

function closeSearchModal() {
  if (!state.searchModalOpen) return;
  state.searchModalOpen = false;
  el.searchModal.classList.remove("open");
  el.searchModal.setAttribute("aria-hidden", "true");
  syncModalBodyState();
}

async function openSessionAndLoad(sessionKey, jumpMessageId = null, detectDelta = false) {
  state.selectedKey = sessionKey;
  state.selectedUpdatedAt = 0;
  state.jumpMessageId = jumpMessageId;
  state.newMessageIds = new Set();
  state.currentSessionPayload = null;
  openSessionModal();
  renderSessions();
  await loadSessionDetail(sessionKey, detectDelta, jumpMessageId);

  const row = state.sessions.find((s) => s.key === sessionKey);
  if (row) state.selectedUpdatedAt = Number(row.updatedAt || 0);
}

function exportSelected(format) {
  if (!state.selectedKey) return;
  const url = `/api/session/export?key=${encodeURIComponent(state.selectedKey)}&format=${format}`;
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.click();
}

function getFilteredSessions() {
  const q = el.searchInput.value.trim().toLowerCase();
  const agent = el.agentFilter.value;

  return state.sessions.filter((session) => {
    if (agent && session.agentId !== agent) return false;
    if (!q) return true;

    const haystack = [
      session.key,
      session.agentId,
      session.displayName || "",
      session.channel || "",
      session.model || "",
      session.kind || "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function renderAgentFilter() {
  const keep = el.agentFilter.value;
  const ids = [...new Set(state.sessions.map((s) => s.agentId).filter(Boolean))].sort();
  el.agentFilter.innerHTML = `<option value="">${escapeHtml(t("agents.all"))}</option>`;
  ids.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    el.agentFilter.appendChild(option);
  });
  if (ids.includes(keep)) {
    el.agentFilter.value = keep;
  }
}

function renderSessions() {
  const sessions = getFilteredSessions();
  el.sessionCount.textContent = `${sessions.length}/${state.sessions.length}`;
  el.sessionList.innerHTML = "";

  if (!sessions.length) {
    el.sessionList.innerHTML = `<p class="empty">${escapeHtml(t("session.empty.filtered"))}</p>`;
    return;
  }

  sessions.forEach((session, index) => {
    const item = document.createElement("button");
    const isActive = state.selectedKey === session.key;
    const isUpdated = state.updatedKeys.has(session.key);
    const kindLabel =
      session.kind && String(session.kind).toLowerCase() !== "unknown"
        ? session.kind
        : session.channel || t("common.session");
    item.className = `session-item ${isActive ? "active" : ""} ${isUpdated ? "fresh" : ""}`;
    item.style.animationDelay = `${Math.min(index * 25, 280)}ms`;

    item.innerHTML = `
      <div class="session-line-top">
        <div class="session-title">${escapeHtml(session.agentId || t("common.unknown"))} · ${escapeHtml(
      kindLabel
    )}</div>
        ${isUpdated ? `<span class="pill">${escapeHtml(t("session.badge.new"))}</span>` : ""}
      </div>
      <div class="session-key">${escapeHtml(session.key || "-")}</div>
      <div class="session-meta-line">
        <span>${escapeHtml(session.channel || "-")}</span>
        <span>${escapeHtml(fmtDate(session.updatedAtIso))}</span>
      </div>
    `;

    item.addEventListener("click", async () => {
      await openSessionAndLoad(session.key);
    });
    el.sessionList.appendChild(item);
  });
}

function renderSessionMeta(payload) {
  const session = payload.session;
  const roleCounts = payload.roleCounts || {};
  el.sessionModalMeta.innerHTML = `
    <strong>${escapeHtml(session.key)}</strong><br />
    ${escapeHtml(t("session.meta.agent"))}: ${escapeHtml(session.agentId || "-")} · ${escapeHtml(
      t("session.meta.model")
    )}: ${escapeHtml(session.model || "-")} ·
    ${escapeHtml(t("session.meta.updated"))}: ${escapeHtml(fmtDate(session.updatedAtIso))}<br />
    ${escapeHtml(t("session.meta.messages"))}: ${fmtNumber(payload.messageCount)} (${escapeHtml(
      t("session.meta.assistant")
    )} ${fmtNumber(
    roleCounts.assistant
  )} / ${escapeHtml(t("session.meta.user"))} ${fmtNumber(roleCounts.user)})
  `;
  el.exportJsonBtn.disabled = false;
  el.exportMdBtn.disabled = false;
}

function scrollToMessage(messageId) {
  if (!messageId) return;
  const items = [...el.sessionModalMessages.querySelectorAll(".msg")];
  const target = items.find((node) => {
    const mainId = node.getAttribute("data-msg-id");
    if (mainId === messageId) return true;
    const linked = (node.getAttribute("data-msg-ids") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return linked.includes(messageId);
  });
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function renderMessages(payload, jumpMessageId) {
  renderSessionMeta(payload);

  const rows = payload.messages || [];
  const displayRows = groupMessagesForDisplay(rows);
  if (!rows.length) {
    el.sessionModalMessages.innerHTML = `<p class="empty">${escapeHtml(t("session.empty.no_messages"))}</p>`;
    return;
  }
  const viewCache = new Map();
  displayRows.forEach((msg) => {
    viewCache.set(msg, collectMessageViewData(msg));
  });
  const visibleRows = getVisibleRows(displayRows, viewCache);
  if (!visibleRows.length) {
    el.sessionModalMessages.innerHTML = `<p class="empty">${escapeHtml(t("session.empty.no_visible"))}</p>`;
    return;
  }

  let prevRole = null;
  let prevDay = "";
  const htmlChunks = [];
  visibleRows.forEach((msg) => {
    const linkedIds = (msg.linkedResults || []).map((row) => row.id).filter(Boolean);
    const isNew = msg.id && state.newMessageIds.has(msg.id);
    const isJump = jumpMessageId && (msg.id === jumpMessageId || linkedIds.includes(jumpMessageId));
    const msgId = msg.id || "";
    const continuation = prevRole === msg.role;
    prevRole = msg.role;

    const dayKey = dayKeyFromTimestamp(msg.timestamp);
    if (dayKey && dayKey !== prevDay) {
      prevDay = dayKey;
      htmlChunks.push(`
        <div class="msg-day-sep">
          <span>${escapeHtml(dayLabelFromTimestamp(msg.timestamp))}</span>
        </div>
      `);
    }

    htmlChunks.push(`
      <article class="msg ${roleClass(msg.role)} ${isNew ? "msg-new" : ""} ${
        isJump ? "msg-jump" : ""
      } ${continuation ? "msg-continuation" : ""}" data-msg-id="${escapeHtml(msgId)}" data-msg-ids="${escapeHtml(
        linkedIds.join(",")
      )}">
        <div class="msg-rail">
          <span class="msg-dot"></span>
        </div>
        <div class="msg-main">
          <header class="${continuation ? "msg-head-compact" : ""}">
            <span class="badge">${escapeHtml(msg.role || t("common.unknown"))}</span>
            <time>${escapeHtml(fmtDate(msg.timestamp))}</time>
          </header>
          ${renderMessageBody(msg, viewCache.get(msg), state.messageView)}
        </div>
      </article>
    `);
  });
  el.sessionModalMessages.innerHTML = htmlChunks.join("");

  if (jumpMessageId) {
    setTimeout(() => scrollToMessage(jumpMessageId), 80);
  }
}

async function loadSessionDetail(key, detectDelta, jumpMessageId = null) {
  el.sessionModalMessages.innerHTML = `<p class="empty">${escapeHtml(t("session.loading"))}</p>`;
  const res = await fetch(`/api/session?key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    const text = await res.text();
    el.sessionModalMessages.innerHTML = `<p class="empty">${escapeHtml(
      t("session.load.failed", { error: text })
    )}</p>`;
    return;
  }

  const data = await res.json();
  state.currentSessionPayload = data;
  const ids = new Set((data.messages || []).map((m) => m.id).filter(Boolean));

  if (detectDelta) {
    const prev = state.messageIdSets.get(key) || new Set();
    const newIds = new Set();
    ids.forEach((id) => {
      if (!prev.has(id)) newIds.add(id);
    });
    state.newMessageIds = newIds;
  } else {
    state.newMessageIds = new Set();
  }

  state.messageIdSets.set(key, ids);
  renderMessages(state.currentSessionPayload, jumpMessageId);
}

async function loadSessions(options = { delta: false }) {
  const oldMap = new Map(state.sessions.map((s) => [s.key, Number(s.updatedAt || 0)]));
  const res = await fetch("/api/sessions");
  if (!res.ok) {
    state.stateDirPath = "";
    el.stateDir.textContent = t("sessions.fetch.failed");
    return;
  }

  const data = await res.json();
  state.sessions = data.sessions || [];
  state.stateDirPath = data.stateDir || "";
  el.stateDir.textContent = data.stateDir;

  const newMap = new Map(state.sessions.map((s) => [s.key, Number(s.updatedAt || 0)]));
  const updated = new Set();
  if (options.delta) {
    newMap.forEach((updatedAt, key) => {
      const old = oldMap.get(key);
      if (old === undefined || updatedAt > old) updated.add(key);
    });
  }
  state.updatedKeys = updated;

  renderAgentFilter();
  renderSessions();

  if (!state.sessions.length) {
    state.selectedKey = null;
    state.selectedUpdatedAt = 0;
    state.newMessageIds = new Set();
    state.jumpMessageId = null;
    state.currentSessionPayload = null;
    el.exportJsonBtn.disabled = true;
    el.exportMdBtn.disabled = true;
    el.sessionModalMeta.textContent = t("sessions.none.readable");
    el.sessionModalMessages.innerHTML = `<p class="empty">${escapeHtml(t("sessions.none.readable"))}</p>`;
    closeSessionModal();
    return;
  }

  if (!state.selectedKey || !newMap.has(state.selectedKey)) {
    state.selectedKey = state.sessions[0].key;
    state.selectedUpdatedAt = Number(state.sessions[0].updatedAt || 0);
  }

  if (state.modalOpen && state.selectedKey) {
    const currentUpdatedAt = Number(newMap.get(state.selectedKey) || 0);
    const shouldReload =
      currentUpdatedAt > state.selectedUpdatedAt || !state.messageIdSets.has(state.selectedKey);
    if (shouldReload || state.jumpMessageId) {
      await loadSessionDetail(state.selectedKey, options.delta, state.jumpMessageId);
      state.selectedUpdatedAt = currentUpdatedAt;
      state.jumpMessageId = null;
    }
  }
}

function renderAgentBars(rows) {
  if (!rows.length) {
    el.agentBars.innerHTML = `<p class="empty">${escapeHtml(t("data.none"))}</p>`;
    return;
  }

  const max = Math.max(...rows.map((row) => row.messages || 0), 1);
  el.agentBars.innerHTML = rows
    .slice(0, 12)
    .map((row) => {
      const width = Math.max(2, Math.round(((row.messages || 0) / max) * 100));
      return `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(row.agentId)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <div class="bar-value">${fmtNumber(row.messages)}</div>
      </div>
    `;
    })
    .join("");
}

function renderHourBars(rows) {
  if (!rows.length) {
    el.hourBars.innerHTML = `<p class="empty">${escapeHtml(t("data.none"))}</p>`;
    return;
  }

  const max = Math.max(...rows.map((row) => row.count || 0), 1);
  el.hourBars.innerHTML = rows
    .map((row) => {
      const ratio = (row.count || 0) / max;
      const h = Math.max(4, Math.round(ratio * 64));
      return `
      <div class="hour-col" title="${row.hour}:00 - ${fmtNumber(row.count)}">
        <div class="hour-bar" style="height:${h}px"></div>
        <span>${row.hour}</span>
      </div>
    `;
    })
    .join("");
}

function renderTokenTrend(rows) {
  if (!rows.length) {
    el.tokenTrend.innerHTML = "";
    el.trendLabels.innerHTML = `<p class="empty">${escapeHtml(t("data.none"))}</p>`;
    el.trendMetrics.innerHTML = "";
    return;
  }

  const max = Math.max(...rows.map((r) => r.tokens || 0), 1);
  const points = rows.map((row, idx) => {
    const x = rows.length === 1 ? 50 : (idx / (rows.length - 1)) * 100;
    const y = 36 - ((row.tokens || 0) / max) * 30;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  el.tokenTrend.innerHTML = `
    <polyline class="trend-area" points="0,40 ${points.join(" ")} 100,40"></polyline>
    <polyline class="trend-line" points="${points.join(" ")}"></polyline>
  `;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const peak = rows.reduce((a, b) => ((a.tokens || 0) >= (b.tokens || 0) ? a : b));
  const total = rows.reduce((sum, row) => sum + Number(row.tokens || 0), 0);
  const avg = total / Math.max(1, rows.length);
  const delta = Number(last.tokens || 0) - Number(first.tokens || 0);
  const pct = Number(first.tokens || 0) > 0 ? (delta / Number(first.tokens || 1)) * 100 : null;

  el.trendLabels.innerHTML = `
    <span>${escapeHtml(first.date)}</span>
    <span>${escapeHtml(t("trend.peak", { tokens: fmtNumber(peak.tokens), date: peak.date }))}</span>
    <span>${escapeHtml(last.date)}</span>
  `;

  const recent = rows.slice(-7);
  const recentMax = Math.max(...recent.map((row) => Number(row.tokens || 0)), 1);
  const trendDirection = delta > 0 ? t("trend.up") : delta < 0 ? t("trend.down") : t("trend.flat");
  const pctText = pct === null ? "-" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  el.trendMetrics.innerHTML = `
    <div class="trend-kpis">
      <article class="trend-kpi">
        <span>${escapeHtml(t("trend.latest"))}</span>
        <strong>${fmtNumber(last.tokens)}</strong>
      </article>
      <article class="trend-kpi">
        <span>${escapeHtml(t("trend.avg"))}</span>
        <strong>${fmtNumber(Math.round(avg))}</strong>
      </article>
      <article class="trend-kpi">
        <span>${escapeHtml(t("trend.change"))}</span>
        <strong>${delta >= 0 ? "+" : ""}${fmtNumber(delta)} (${pctText})</strong>
      </article>
      <article class="trend-kpi">
        <span>${escapeHtml(t("trend.direction"))}</span>
        <strong>${trendDirection}</strong>
      </article>
    </div>
    <div class="trend-recent">
      ${recent
        .map((row) => {
          const v = Number(row.tokens || 0);
          const h = Math.max(8, Math.round((v / recentMax) * 40));
          const label = String(row.date || "").slice(5);
          return `
            <div class="trend-recent-col" title="${escapeHtml(row.date)} · ${fmtNumber(v)}">
              <div class="trend-recent-bar" style="height:${h}px"></div>
              <span>${escapeHtml(label)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function scheduleMentionRender() {
  if (state.mentionRafPending) return;
  state.mentionRafPending = true;
  requestAnimationFrame(() => {
    state.mentionRafPending = false;
    drawMentionNetworkSvg();
  });
}

function applyMentionSelectionStyles() {
  const selectedEdge = state.mentionEdges.find((x) => `${x.from}->${x.to}` === state.mentionSelectedEdgeKey) || null;
  state.mentionEdgeRefs.forEach((ref, key) => {
    ref.line.setAttribute("class", `mention-edge ${key === state.mentionSelectedEdgeKey ? "selected" : ""}`);
  });
  state.mentionNodeRefs.forEach((ref, nodeId) => {
    const selected =
      state.mentionSelectedNodeId === nodeId ||
      (selectedEdge && (selectedEdge.from === nodeId || selectedEdge.to === nodeId));
    ref.circle.setAttribute("class", `mention-node ${selected ? "selected" : ""}`);
  });
}

function updateMentionNodePosition(nodeId) {
  const node = state.mentionNodeLookup.get(nodeId);
  const ref = state.mentionNodeRefs.get(nodeId);
  if (!node || !ref) return;
  ref.circle.setAttribute("cx", node.x);
  ref.circle.setAttribute("cy", node.y);
  ref.label.setAttribute("x", node.x);
  ref.label.setAttribute("y", node.y + ref.radius + 14);
  ref.count.setAttribute("x", node.x);
  ref.count.setAttribute("y", node.y + 4);
}

function updateMentionEdgePosition(edgeKey) {
  const ref = state.mentionEdgeRefs.get(edgeKey);
  if (!ref) return;
  const from = state.mentionNodeLookup.get(ref.from);
  const to = state.mentionNodeLookup.get(ref.to);
  if (!from || !to) return;
  ref.line.setAttribute("x1", from.x);
  ref.line.setAttribute("y1", from.y);
  ref.line.setAttribute("x2", to.x);
  ref.line.setAttribute("y2", to.y);
  ref.hit.setAttribute("x1", from.x);
  ref.hit.setAttribute("y1", from.y);
  ref.hit.setAttribute("x2", to.x);
  ref.hit.setAttribute("y2", to.y);
}

function scheduleMentionDragUpdate(nodeId) {
  state.mentionDragNodeUpdateId = nodeId;
  if (state.mentionDragRafPending) return;
  state.mentionDragRafPending = true;
  requestAnimationFrame(() => {
    state.mentionDragRafPending = false;
    const id = state.mentionDragNodeUpdateId;
    if (!id) return;
    updateMentionNodePosition(id);
    const edges = state.mentionNodeToEdges.get(id) || [];
    edges.forEach((edgeKey) => updateMentionEdgePosition(edgeKey));
  });
}

function setMentionSelection(edgeKey, nodeId = null) {
  if (edgeKey) {
    state.mentionSelectedEdgeKey = edgeKey;
  }
  state.mentionSelectedNodeId = nodeId;
  drawMentionDetails();
  if (state.mentionNodeRefs.size && state.mentionEdgeRefs.size) {
    applyMentionSelectionStyles();
  } else {
    scheduleMentionRender();
  }
}

function drawMentionDetails() {
  if (!state.mentionEdges.length) {
    el.mentionDetails.innerHTML = `<p class="mention-empty">${escapeHtml(t("mention.empty.data"))}</p>`;
    return;
  }

  let edge = state.mentionEdges.find((x) => `${x.from}->${x.to}` === state.mentionSelectedEdgeKey);
  if (!edge) {
    edge = state.mentionEdges[0];
    state.mentionSelectedEdgeKey = `${edge.from}->${edge.to}`;
  }

  const samples = edge.samples || [];
  const visibleSamples = samples.slice(0, 3);
  const hiddenCount = Math.max(0, samples.length - visibleSamples.length);
  el.mentionDetails.innerHTML = `
    <div class="mention-edge-head">
      <strong>${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}</strong>
      <div class="mention-stats">
        <span class="mention-pill">${escapeHtml(t("mention.count", { count: fmtNumber(edge.count) }))}</span>
        <span class="mention-pill">${escapeHtml(t("mention.samples", { count: fmtNumber(samples.length) }))}</span>
      </div>
    </div>
    <p class="mention-tip">${escapeHtml(t("mention.tip"))}</p>
    <div class="mention-samples">
      ${
        visibleSamples.length
          ? visibleSamples
              .map(
                (sample, idx) => `
          <button class="mention-sample" data-session="${escapeHtml(sample.sessionKey || "")}" data-message="${
                  sample.messageId ? escapeHtml(sample.messageId) : ""
                }">
            <div class="sample-head">
              <span class="sample-index">#${idx + 1}</span>
              <span class="sample-time">${escapeHtml(fmtDate(sample.timestampIso || sample.timestampMs))}</span>
            </div>
            <span class="sample-text">${escapeHtml(sample.excerpt || "")}</span>
          </button>
        `
              )
              .join("")
          : `<p class="mention-empty">${escapeHtml(t("mention.empty.samples"))}</p>`
      }
      ${
        hiddenCount
          ? `<p class="mention-empty">${escapeHtml(t("mention.samples.hidden", { count: fmtNumber(hiddenCount) }))}</p>`
          : ""
      }
    </div>
  `;

  el.mentionDetails.querySelectorAll(".mention-sample").forEach((node) => {
    node.addEventListener("click", async () => {
      const sessionKey = node.getAttribute("data-session");
      const messageId = node.getAttribute("data-message") || null;
      if (!sessionKey) return;
      await openSessionAndLoad(sessionKey, messageId);
    });
  });
}

function drawMentionNetworkSvg() {
  const svg = el.mentionNetwork;
  const width = 640;
  const height = 280;
  svg.innerHTML = "";

  state.mentionNodeLookup = new Map(state.mentionNodes.map((node) => [node.id, node]));
  state.mentionNodeRefs = new Map();
  state.mentionEdgeRefs = new Map();
  state.mentionNodeToEdges = new Map(state.mentionNodes.map((node) => [node.id, []]));
  state.mentionDragNodeUpdateId = null;

  if (!state.mentionNodes.length) {
    return;
  }

  const maxEdge = Math.max(...state.mentionEdges.map((e) => e.count || 0), 1);
  const edgeFrag = document.createDocumentFragment();
  const nodeFrag = document.createDocumentFragment();

  state.mentionEdges.forEach((edge) => {
    const from = state.mentionNodeLookup.get(edge.from);
    const to = state.mentionNodeLookup.get(edge.to);
    if (!from || !to) return;

    const key = `${edge.from}->${edge.to}`;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.setAttribute("class", "mention-edge");
    line.setAttribute("stroke-width", String(1 + ((edge.count || 0) / maxEdge) * 5));
    edgeFrag.appendChild(line);

    const hit = document.createElementNS("http://www.w3.org/2000/svg", "line");
    hit.setAttribute("x1", from.x);
    hit.setAttribute("y1", from.y);
    hit.setAttribute("x2", to.x);
    hit.setAttribute("y2", to.y);
    hit.setAttribute("class", "mention-edge-hit");
    hit.addEventListener("click", (event) => {
      event.stopPropagation();
      setMentionSelection(key, null);
    });
    edgeFrag.appendChild(hit);

    state.mentionEdgeRefs.set(key, { line, hit, from: edge.from, to: edge.to });
    if (state.mentionNodeToEdges.has(edge.from)) {
      state.mentionNodeToEdges.get(edge.from).push(key);
    }
    if (state.mentionNodeToEdges.has(edge.to)) {
      state.mentionNodeToEdges.get(edge.to).push(key);
    }
  });
  svg.appendChild(edgeFrag);

  state.mentionNodes.forEach((node) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "mention-node-group");

    const radius = 12 + Math.min(14, Math.round(Math.sqrt(node.messages || 1)));

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", node.x);
    circle.setAttribute("cy", node.y);
    circle.setAttribute("r", String(radius));
    circle.setAttribute("class", "mention-node");
    circle.setAttribute("data-id", node.id);
    circle.style.cursor = "grab";
    g.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", node.x);
    label.setAttribute("y", node.y + radius + 14);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "mention-node-label");
    label.textContent = node.id;
    g.appendChild(label);

    const count = document.createElementNS("http://www.w3.org/2000/svg", "text");
    count.setAttribute("x", node.x);
    count.setAttribute("y", node.y + 4);
    count.setAttribute("text-anchor", "middle");
    count.setAttribute("class", "mention-node-count");
    count.textContent = String(node.messages || 0);
    g.appendChild(count);

    circle.addEventListener("pointerdown", (event) => {
      state.mentionDraggingNodeId = node.id;
      state.mentionDragMoved = false;
      state.mentionDragStartX = event.clientX;
      state.mentionDragStartY = event.clientY;
      circle.setPointerCapture(event.pointerId);
      circle.style.cursor = "grabbing";
    });

    circle.addEventListener("pointerup", (event) => {
      if (state.mentionDraggingNodeId === node.id) {
        state.mentionDraggingNodeId = null;
      }
      try {
        circle.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
      circle.style.cursor = "grab";

      if (!state.mentionDragMoved) {
        const related = state.mentionEdges
          .filter((e) => e.from === node.id || e.to === node.id)
          .sort((a, b) => (b.count || 0) - (a.count || 0));
        if (related.length) {
          setMentionSelection(`${related[0].from}->${related[0].to}`, node.id);
        } else {
          state.mentionSelectedNodeId = node.id;
          drawMentionDetails();
          applyMentionSelectionStyles();
        }
      } else {
        state.mentionSelectedNodeId = node.id;
        drawMentionDetails();
        applyMentionSelectionStyles();
      }
    });

    circle.addEventListener("pointercancel", () => {
      state.mentionDraggingNodeId = null;
      circle.style.cursor = "grab";
    });

    circle.addEventListener("pointermove", (event) => {
      if (state.mentionDraggingNodeId !== node.id) return;
      const rect = svg.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * width;
      const ny = ((event.clientY - rect.top) / rect.height) * height;
      const clampX = Math.max(26, Math.min(width - 26, nx));
      const clampY = Math.max(26, Math.min(height - 26, ny));

      const movedDist = Math.hypot(event.clientX - state.mentionDragStartX, event.clientY - state.mentionDragStartY);
      if (movedDist > 3) {
        state.mentionDragMoved = true;
      }

      node.x = clampX;
      node.y = clampY;
      state.mentionNodePos[node.id] = { x: clampX, y: clampY };
      scheduleMentionDragUpdate(node.id);
      event.preventDefault();
    });

    state.mentionNodeRefs.set(node.id, { g, circle, label, count, radius });
    nodeFrag.appendChild(g);
  });
  svg.appendChild(nodeFrag);
  applyMentionSelectionStyles();
}

function renderMentionNetwork(edges, nodes) {
  state.mentionEdges = edges || [];

  const list = (nodes || []).map((node) => ({ ...node }));
  const width = 640;
  const height = 280;

  if (!list.length && state.mentionEdges.length) {
    const set = new Set();
    state.mentionEdges.forEach((edge) => {
      set.add(edge.from);
      set.add(edge.to);
    });
    set.forEach((id) => list.push({ id, messages: 1 }));
  }

  const n = list.length || 1;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.34;

  state.mentionNodes = list.map((node, idx) => {
    const saved = state.mentionNodePos[node.id];
    if (saved) {
      return { ...node, x: saved.x, y: saved.y };
    }
    const angle = (Math.PI * 2 * idx) / n;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * (r * 0.8);
    state.mentionNodePos[node.id] = { x, y };
    return { ...node, x, y };
  });

  if (!state.mentionEdges.length) {
    state.mentionSelectedEdgeKey = null;
    state.mentionSelectedNodeId = null;
    drawMentionDetails();
    drawMentionNetworkSvg();
    return;
  }

  const hasSelected = state.mentionEdges.some(
    (edge) => `${edge.from}->${edge.to}` === state.mentionSelectedEdgeKey
  );
  if (!hasSelected) {
    state.mentionSelectedEdgeKey = `${state.mentionEdges[0].from}->${state.mentionEdges[0].to}`;
  }

  drawMentionDetails();
  drawMentionNetworkSvg();
}

function renderStats(data) {
  const totals = data.totals || {};
  el.totalSessions.textContent = fmtNumber(totals.sessions);
  el.totalMessages.textContent = fmtNumber(totals.messages);
  el.totalTokens.textContent = fmtNumber(totals.tokens);

  const range = data.activeRange || {};
  const from = fmtDateCompact(range.fromIso);
  const to = fmtDateCompact(range.toIso);
  el.activeRange.innerHTML = `
    <span class="range-line">
      <em>${escapeHtml(t("range.from"))}</em>
      <strong>${escapeHtml(from)}</strong>
    </span>
    <span class="range-line">
      <em>${escapeHtml(t("range.to"))}</em>
      <strong>${escapeHtml(to)}</strong>
    </span>
  `;

  renderAgentBars(data.byAgent || []);
  renderHourBars(data.activeHours || []);
  renderTokenTrend(data.tokenTrend || []);
  renderMentionNetwork(data.mentionEdges || [], data.mentionNodes || []);
}

async function loadStats() {
  const res = await fetch("/api/stats");
  if (!res.ok) return;
  const data = await res.json();
  state.lastStats = data;
  renderStats(data);
}

function normalizeSearchTerms(query) {
  return String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

function highlightSearchSnippet(snippet, query) {
  const terms = normalizeSearchTerms(query);
  let html = escapeHtml(String(snippet || ""));
  if (!terms.length || !html) return html;
  terms
    .sort((a, b) => b.length - a.length)
    .forEach((term) => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(escapedTerm, "gi"), (match) => `<mark>${match}</mark>`);
    });
  return html;
}

function renderSearchResults() {
  const rows = state.searchResults;
  el.searchResultCount.textContent = fmtNumber(rows.length);
  if (!rows.length) {
    const emptyText = state.searchQuery ? t("search.empty.results") : t("search.empty.prompt");
    el.searchResults.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }

  el.searchResults.innerHTML = rows
    .map(
      (row, idx) => `
    <button class="search-hit" data-session="${escapeHtml(row.sessionKey || "")}" data-message="${
        row.messageId ? escapeHtml(row.messageId) : ""
      }">
      <div class="hit-head">
        <span>#${idx + 1} · ${escapeHtml(row.agentId || "-")} · ${escapeHtml(row.role || "-")}</span>
        <span>${escapeHtml(fmtDate(row.timestampIso || row.timestamp))}</span>
      </div>
      <div class="hit-session">${escapeHtml(row.sessionKey || "")}</div>
      <div class="hit-snippet">${highlightSearchSnippet(row.snippet || "", state.searchQuery)}</div>
    </button>
  `
    )
    .join("");

  el.searchResults.querySelectorAll(".search-hit").forEach((node) => {
    node.addEventListener("click", async () => {
      const sessionKey = node.getAttribute("data-session");
      const messageId = node.getAttribute("data-message") || null;
      if (!sessionKey) return;
      closeSearchModal();
      await openSessionAndLoad(sessionKey, messageId);
    });
  });
}

async function runGlobalSearch() {
  const q = el.globalSearchInput.value.trim();
  state.searchQuery = q;
  if (!q) {
    state.searchResults = [];
    renderSearchResults();
    return;
  }

  el.searchResults.innerHTML = `<p class="empty">${escapeHtml(t("search.loading"))}</p>`;
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=220`);
  if (!res.ok) {
    const text = await res.text();
    el.searchResults.innerHTML = `<p class="empty">${escapeHtml(t("search.failed", { error: text }))}</p>`;
    return;
  }

  const data = await res.json();
  state.searchResults = data.results || [];
  renderSearchResults();
}

function clearGlobalSearch() {
  state.searchQuery = "";
  state.searchResults = [];
  el.globalSearchInput.value = "";
  renderSearchResults();
  el.globalSearchInput.focus();
}

function scheduleGlobalSearch() {
  if (state.searchDebounceTimer) {
    clearTimeout(state.searchDebounceTimer);
  }
  state.searchDebounceTimer = setTimeout(() => {
    runGlobalSearch();
  }, 260);
}

function setupAutoRefresh() {
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
  }
  if (!el.autoRefresh.checked) return;

  const interval = Number(el.refreshInterval.value || 10000);
  state.autoTimer = setInterval(() => {
    refreshAll(true);
  }, interval);
}

function applyInitialOpenState() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("open") === "search") {
    openSearchModal();
  }
}

async function refreshAll(delta = false) {
  if (state.refreshing) return;
  state.refreshing = true;
  try {
    await Promise.all([loadSessions({ delta }), loadStats()]);
  } finally {
    state.refreshing = false;
  }
}

el.refreshBtn.addEventListener("click", () => {
  refreshAll(false);
});
el.searchInput.addEventListener("input", renderSessions);
el.agentFilter.addEventListener("change", renderSessions);
el.autoRefresh.addEventListener("change", setupAutoRefresh);
el.refreshInterval.addEventListener("change", setupAutoRefresh);
el.exportJsonBtn.addEventListener("click", () => exportSelected("json"));
el.exportMdBtn.addEventListener("click", () => exportSelected("md"));
el.globalSearchOpenBtn.addEventListener("click", openSearchModal);
el.globalSearchBtn.addEventListener("click", runGlobalSearch);
el.globalSearchClearBtn.addEventListener("click", clearGlobalSearch);
el.globalSearchInput.addEventListener("input", scheduleGlobalSearch);
if (el.langSelect) {
  el.langSelect.addEventListener("change", () => {
    setLanguage(el.langSelect.value);
  });
}
el.globalSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runGlobalSearch();
  }
});
if (el.viewOnlyDialogue && el.viewShowTools && el.viewShowMeta) {
  el.viewOnlyDialogue.addEventListener("change", () => {
    state.messageView.onlyDialogue = !!el.viewOnlyDialogue.checked;
    syncMessageViewControls();
    rerenderCurrentSession();
  });
  el.viewShowTools.addEventListener("change", () => {
    state.messageView.showTools = !!el.viewShowTools.checked;
    syncMessageViewControls();
    rerenderCurrentSession();
  });
  el.viewShowMeta.addEventListener("change", () => {
    state.messageView.showMeta = !!el.viewShowMeta.checked;
    syncMessageViewControls();
    rerenderCurrentSession();
  });
}

el.sessionModalClose.addEventListener("click", closeSessionModal);
el.sessionModal.addEventListener("click", (event) => {
  if (event.target === el.sessionModal) {
    closeSessionModal();
  }
});
el.searchModalClose.addEventListener("click", closeSearchModal);
el.searchModal.addEventListener("click", (event) => {
  if (event.target === el.searchModal) {
    closeSearchModal();
  }
});
document.addEventListener("keydown", (event) => {
  const isQuickSearch = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
  if (isQuickSearch) {
    event.preventDefault();
    openSearchModal();
    return;
  }
  if (event.key === "Escape") {
    if (state.searchModalOpen) {
      closeSearchModal();
      return;
    }
    closeSessionModal();
  }
});

initLanguage();
syncMessageViewControls();
setupAutoRefresh();
renderSearchResults();
applyInitialOpenState();
refreshAll(false);
