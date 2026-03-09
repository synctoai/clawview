const state = {
  lang: "zh-CN",
  cursorMs: 0,
  running: false,
  timer: null,
  seen: new Set(),
  rows: [],
};

const el = {
  status: document.getElementById("live-status"),
  langSelect: document.getElementById("live-lang-select"),
  minutes: document.getElementById("live-minutes"),
  interval: document.getElementById("live-interval"),
  start: document.getElementById("live-start"),
  stop: document.getElementById("live-stop"),
  clear: document.getElementById("live-clear"),
  count: document.getElementById("live-count"),
  list: document.getElementById("live-list"),
};

const DEFAULT_LANG = "zh-CN";
const LANGUAGE_STORAGE_KEY = "clawview_lang";
const I18N = {
  "zh-CN": {
    "live.page.title": "Agent 会话总览 · ClawView Live",
    "live.header.title": "Agent 会话总览 · 增量追踪",
    "live.status.waiting": "等待启动...",
    "live.window.label": "窗口",
    "live.window.5m": "5 分钟",
    "live.window.10m": "10 分钟",
    "live.window.30m": "30 分钟",
    "live.window.60m": "60 分钟",
    "live.polling.label": "轮询",
    "language.select.title": "语言 / Language",
    "language.zh": "中文",
    "language.en": "English",
    "button.start": "开始",
    "button.pause": "暂停",
    "button.clear": "清空",
    "live.back.main": "返回主面板",
    "live.feed.title": "新增消息流",
    "live.empty.none": "暂无新增消息",
    "live.fetch.failed": "拉取失败",
    "live.running": "运行中 · {time} · 新增 {count} 条 · cursor {cursor}",
    "live.error": "异常: {error}",
    "live.paused": "已暂停",
    "live.starting": "启动中...",
    "live.cleared": "已清空",
  },
  "en-US": {
    "live.page.title": "Agent Session Overview · ClawView Live",
    "live.header.title": "Agent Session Overview · Live Stream",
    "live.status.waiting": "Waiting to start...",
    "live.window.label": "Window",
    "live.window.5m": "5 min",
    "live.window.10m": "10 min",
    "live.window.30m": "30 min",
    "live.window.60m": "60 min",
    "live.polling.label": "Polling",
    "language.select.title": "Language / 语言",
    "language.zh": "中文",
    "language.en": "English",
    "button.start": "Start",
    "button.pause": "Pause",
    "button.clear": "Clear",
    "live.back.main": "Back to Dashboard",
    "live.feed.title": "Incoming Messages",
    "live.empty.none": "No new messages",
    "live.fetch.failed": "Fetch failed",
    "live.running": "Running · {time} · +{count} · cursor {cursor}",
    "live.error": "Error: {error}",
    "live.paused": "Paused",
    "live.starting": "Starting...",
    "live.cleared": "Cleared",
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
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const key = node.getAttribute("data-i18n-title");
    if (!key) return;
    node.setAttribute("title", t(key));
  });
  document.title = t("live.page.title");
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
  if (state.running) {
    const now = new Date().toLocaleTimeString(state.lang);
    el.status.textContent = t("live.running", { time: now, count: 0, cursor: state.cursorMs });
  }
  renderRows();
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

function rowKey(row) {
  return [row.sessionKey || "", row.messageId || "", row.timestampMs || "", row.role || ""].join("|");
}

function renderRows() {
  el.count.textContent = state.rows.length.toLocaleString(state.lang);
  if (!state.rows.length) {
    el.list.innerHTML = `<p class="empty">${escapeHtml(t("live.empty.none"))}</p>`;
    return;
  }

  el.list.innerHTML = state.rows
    .map(
      (row) => `
      <article class="live-item ${escapeHtml((row.role || "").toLowerCase())}">
        <header>
          <span>${escapeHtml(row.agentId || "-")} · ${escapeHtml(row.role || "-")}</span>
          <time>${escapeHtml(fmtDate(row.timestampIso || row.timestamp))}</time>
        </header>
        <div class="live-session">${escapeHtml(row.sessionKey || "")}</div>
        <pre>${escapeHtml(row.text || "")}</pre>
      </article>
    `
    )
    .join("");
}

async function pollRecent() {
  if (!state.running) return;
  const minutes = Number(el.minutes.value || 10);
  const url = `/api/recent?minutes=${minutes}&sinceMs=${state.cursorMs}&limit=1200`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      el.status.textContent = t("live.fetch.failed");
      return;
    }
    const data = await res.json();

    const incoming = data.messages || [];
    let added = 0;
    for (const row of incoming) {
      const key = rowKey(row);
      if (state.seen.has(key)) continue;
      state.seen.add(key);
      state.rows.unshift(row);
      added += 1;
    }

    if (state.rows.length > 3000) {
      state.rows = state.rows.slice(0, 3000);
    }

    state.cursorMs = Math.max(state.cursorMs, Number(data.nextSinceMs || state.cursorMs));
    renderRows();

    const now = new Date().toLocaleTimeString(state.lang);
    el.status.textContent = t("live.running", {
      time: now,
      count: added,
      cursor: state.cursorMs,
    });
  } catch (error) {
    el.status.textContent = t("live.error", { error });
  }
}

function resetWindow() {
  const minutes = Number(el.minutes.value || 10);
  state.cursorMs = Date.now() - minutes * 60 * 1000;
  state.seen = new Set();
  state.rows = [];
  renderRows();
}

function stopPolling() {
  state.running = false;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  el.status.textContent = t("live.paused");
}

function startPolling() {
  stopPolling();
  resetWindow();

  state.running = true;
  const interval = Number(el.interval.value || 5000);
  el.status.textContent = t("live.starting");
  pollRecent();
  state.timer = setInterval(pollRecent, interval);
}

el.start.addEventListener("click", startPolling);
el.stop.addEventListener("click", stopPolling);
el.clear.addEventListener("click", () => {
  resetWindow();
  el.status.textContent = t("live.cleared");
});
if (el.langSelect) {
  el.langSelect.addEventListener("change", () => {
    setLanguage(el.langSelect.value);
  });
}

initLanguage();
startPolling();
