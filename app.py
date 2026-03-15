#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import shutil
import threading
import time
import webbrowser
from collections import defaultdict
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

HISTORY_SCHEMA_VERSION = 1
DEFAULT_HISTORY_ROOT = Path.home() / ".clawview"
HISTORY_DIRNAME = ".clawview"
HISTORY_SUBPATH = Path("history") / f"v{HISTORY_SCHEMA_VERSION}"
HISTORY_ENV_KEYS = ("CLAWVIEW_HISTORY_DIR", "CLAWVIEW_BACKUP_DIR")
HISTORY_SYNC_INTERVAL_MS = 3000
_HISTORY_LOCK = threading.Lock()
_HISTORY_CACHE: dict[str, Any] = {
    "stateDir": None,
    "historyDir": None,
    "syncedAtMs": 0,
    "sessions": [],
}


def _resolve_history_root(raw: Any) -> Path:
    if isinstance(raw, (str, Path)) and str(raw).strip():
        base = Path(str(raw).strip())
    else:
        base = DEFAULT_HISTORY_ROOT
    return base.expanduser().resolve()


def _resolve_history_dir(raw_root: Any) -> Path:
    root = _resolve_history_root(raw_root)
    # If root is already ".clawview", avoid creating nested ".clawview/.clawview".
    if root.name == HISTORY_DIRNAME:
        return (root / HISTORY_SUBPATH).resolve()
    return (root / HISTORY_DIRNAME / HISTORY_SUBPATH).resolve()


def parse_args() -> argparse.Namespace:
    env_history = ""
    for key in HISTORY_ENV_KEYS:
        value = os.getenv(key)
        if value and value.strip():
            env_history = value.strip()
            break

    parser = argparse.ArgumentParser(
        description="Visualize OpenClaw sessions in a local web UI."
    )
    parser.add_argument(
        "--state-dir",
        default=str(Path.home() / ".openclaw"),
        help="OpenClaw state directory (default: ~/.openclaw)",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8788, help="Bind port")
    parser.add_argument(
        "--open",
        action="store_true",
        help="Open browser automatically after server starts",
    )
    parser.add_argument(
        "--history-root",
        default=env_history or str(DEFAULT_HISTORY_ROOT),
        help="History storage root directory (env: CLAWVIEW_HISTORY_DIR or CLAWVIEW_BACKUP_DIR, default: ~/.clawview)",
    )
    return parser.parse_args()


def _safe_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _safe_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _query_int(
    query: dict[str, list[str]],
    name: str,
    default: int,
    min_value: int,
    max_value: int,
) -> int:
    raw = (query.get(name) or [None])[0]
    if raw is None:
        return default
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return default
    return max(min_value, min(max_value, val))


def _to_ms(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        iv = int(value)
        if iv > 10_000_000_000:
            return iv
        return iv * 1000
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return 0
        if s.isdigit():
            iv = int(s)
            if iv > 10_000_000_000:
                return iv
            return iv * 1000
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except ValueError:
            return 0
    return 0


def _iso_from_ms(ms: int) -> str | None:
    if ms <= 0:
        return None
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.isoformat()


TOOL_NAME_MAP = {
    "read": "read_file",
    "write": "write_file",
    "edit": "edit_file",
    "exec": "run_shell",
    "bash": "run_shell",
    "find": "find_text",
    "grep": "find_text",
}


def _normalize_tool_name(name: str) -> str:
    base = (name or "tool").strip().lower()
    if not base:
        return "tool"
    if base in TOOL_NAME_MAP:
        return TOOL_NAME_MAP[base]
    return re.sub(r"[^a-z0-9]+", "_", base).strip("_") or "tool"


def _extract_tool_result_text(raw_content: Any) -> str:
    text_bits: list[str] = []
    if isinstance(raw_content, list):
        for result_part in raw_content:
            if isinstance(result_part, dict) and result_part.get("type") == "text":
                result_text = result_part.get("text", "")
                if result_text:
                    text_bits.append(str(result_text))
    elif isinstance(raw_content, str):
        text_bits.append(raw_content)
    return "\n".join(text_bits).strip()


def _extract_message_parts(content: Any) -> list[dict[str, Any]]:
    if isinstance(content, str):
        return [{"type": "text", "text": _truncate(content, 25000)}]
    if not isinstance(content, list):
        return []

    parts: list[dict[str, Any]] = []
    for item in content:
        if not isinstance(item, dict):
            continue
        item_type = item.get("type")

        if item_type == "text":
            text = item.get("text", "")
            if text:
                parts.append({"type": "text", "text": _truncate(str(text), 25000)})
            continue

        if item_type == "toolCall":
            raw_name = str(item.get("name", "tool"))
            args = item.get("arguments")
            if args is None and item.get("partialJson"):
                args = item.get("partialJson")
            if isinstance(args, (dict, list)):
                detail = json.dumps(args, ensure_ascii=False, indent=2)
            else:
                detail = str(args or "").strip()
            parts.append(
                {
                    "type": "tool_call",
                    "tool": raw_name,
                    "toolLabel": _normalize_tool_name(raw_name),
                    "detail": _truncate(detail, 25000),
                }
            )
            continue

        if item_type == "toolResult":
            raw_name = str(item.get("toolName", "tool"))
            detail = _extract_tool_result_text(item.get("content"))
            parts.append(
                {
                    "type": "tool_result",
                    "tool": raw_name,
                    "toolLabel": _normalize_tool_name(raw_name),
                    "detail": _truncate(detail, 25000),
                }
            )
            continue

        if item_type == "thinking":
            parts.append({"type": "thinking", "text": "(thinking omitted)"})

    return parts


def _extract_readable_text(content: Any) -> str:
    parts = _extract_message_parts(content)
    chunks: list[str] = []
    saw_thinking = False
    for part in parts:
        part_type = part.get("type")
        if part_type == "text":
            text = str(part.get("text") or "").strip()
            if text:
                chunks.append(text)
        elif part_type == "tool_call":
            label = str(part.get("toolLabel") or part.get("tool") or "tool")
            detail = str(part.get("detail") or "").strip()
            block = f"[ToolCall] {label}"
            if detail:
                block += "\n" + detail
            chunks.append(block)
        elif part_type == "tool_result":
            label = str(part.get("toolLabel") or part.get("tool") or "tool")
            detail = str(part.get("detail") or "").strip()
            block = f"[ToolResult] {label}"
            if detail:
                block += "\n" + detail
            chunks.append(block)
        elif part_type == "thinking":
            saw_thinking = True

    if chunks:
        return "\n\n".join(chunks).strip()
    if saw_thinking:
        return "(thinking omitted)"
    return ""


def _extract_plain_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""
    out: list[str] = []
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text" and item.get("text"):
            out.append(str(item.get("text")))
    return "\n".join(out).strip()


def _truncate(text: str, max_chars: int) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "..."


def _stable_hash(*parts: str) -> str:
    h = hashlib.sha1()
    for part in parts:
        h.update(str(part).encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()


def _write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(body, encoding="utf-8")
    tmp.replace(path)


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.is_file():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def _make_excerpt(text: str, terms: list[str], radius: int = 140) -> str:
    body = " ".join(text.split())
    if not body:
        return ""
    if not terms:
        return _truncate(body, 2 * radius)

    lower = body.lower()
    idx = -1
    for term in terms:
        pos = lower.find(term)
        if pos >= 0 and (idx == -1 or pos < idx):
            idx = pos

    if idx < 0:
        return _truncate(body, 2 * radius)

    start = max(0, idx - radius)
    end = min(len(body), idx + radius)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(body) else ""
    return prefix + body[start:end].strip() + suffix


def _infer_session_kind(session_key: str, meta_kind: Any) -> str:
    raw_kind = str(meta_kind or "").strip().lower()
    if raw_kind and raw_kind != "unknown":
        return raw_kind

    key = session_key.lower()
    if ":run:" in key:
        return "run"
    if ":cron:" in key:
        return "cron"
    if key.endswith(":main"):
        return "main"
    if ":channel:" in key or ":group:" in key:
        return "group"
    if ":dm:" in key or ":direct:" in key:
        return "direct"
    return "session"


def _load_live_session_meta(state_dir: Path) -> list[dict[str, Any]]:
    agents_dir = state_dir / "agents"
    if not agents_dir.is_dir():
        return []

    rows: list[dict[str, Any]] = []
    for agent_dir in sorted(agents_dir.iterdir()):
        if not agent_dir.is_dir():
            continue
        agent_id = agent_dir.name
        index_file = agent_dir / "sessions" / "sessions.json"
        if not index_file.is_file():
            continue

        try:
            data = json.loads(index_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue

        if not isinstance(data, dict):
            continue

        for key, meta in data.items():
            if not isinstance(meta, dict):
                continue

            session_file = meta.get("sessionFile")
            if session_file:
                session_path = Path(session_file)
                if not session_path.is_absolute():
                    session_path = (index_file.parent / session_path).resolve()
            else:
                session_path = None

            rows.append(
                {
                    "id": _stable_hash(
                        str(meta.get("agentId") or agent_id).lower(),
                        str(key),
                        str(meta.get("sessionId") or session_path or ""),
                    ),
                    "uid": _stable_hash(
                        str(meta.get("agentId") or agent_id).lower(),
                        str(key),
                        str(meta.get("sessionId") or session_path or ""),
                    ),
                    "key": key,
                    "agentId": meta.get("agentId") or agent_id,
                    "updatedAt": _safe_int(meta.get("updatedAt")),
                    "sessionId": meta.get("sessionId"),
                    "kind": _infer_session_kind(key, meta.get("kind")),
                    "model": meta.get("model"),
                    "displayName": meta.get("displayName"),
                    "channel": meta.get("lastChannel") or meta.get("channel"),
                    "target": meta.get("lastTo"),
                    "sessionFile": str(session_path) if session_path else None,
                    "storePath": str(index_file),
                    "inputTokens": _safe_optional_int(meta.get("inputTokens")),
                    "outputTokens": _safe_optional_int(meta.get("outputTokens")),
                    "totalTokens": _safe_optional_int(meta.get("totalTokens")),
                    "active": True,
                    "isArchived": False,
                }
            )

    rows.sort(key=lambda row: row.get("updatedAt", 0), reverse=True)
    return rows


def _history_index_path(history_dir: Path) -> Path:
    return history_dir / "index.json"


def _default_history_index(state_dir: Path, history_dir: Path) -> dict[str, Any]:
    return {
        "schemaVersion": HISTORY_SCHEMA_VERSION,
        "stateDir": str(state_dir),
        "historyDir": str(history_dir),
        "updatedAtMs": 0,
        "updatedAtIso": None,
        "activeSlots": {},
        "sessions": {},
    }


def _load_history_index(state_dir: Path, history_dir: Path) -> dict[str, Any]:
    path = _history_index_path(history_dir)
    base = _default_history_index(state_dir, history_dir)
    raw = _read_json(path, {})
    if not isinstance(raw, dict):
        return base

    version = _safe_int(raw.get("schemaVersion"), 0)
    if version != HISTORY_SCHEMA_VERSION:
        return base

    sessions = raw.get("sessions")
    active_slots = raw.get("activeSlots")
    if not isinstance(sessions, dict):
        sessions = {}
    if not isinstance(active_slots, dict):
        active_slots = {}

    return {
        "schemaVersion": HISTORY_SCHEMA_VERSION,
        "stateDir": str(raw.get("stateDir") or state_dir),
        "historyDir": str(raw.get("historyDir") or history_dir),
        "updatedAtMs": _safe_int(raw.get("updatedAtMs")),
        "updatedAtIso": raw.get("updatedAtIso"),
        "activeSlots": {
            str(slot): str(archive_id)
            for slot, archive_id in active_slots.items()
            if isinstance(slot, str) and isinstance(archive_id, str)
        },
        "sessions": {str(k): v for k, v in sessions.items() if isinstance(v, dict)},
    }


def _to_history_row(
    archive_id: str, meta: dict[str, Any], index_file: Path
) -> dict[str, Any] | None:
    session_file = meta.get("sessionFile")
    if session_file:
        session_path = Path(str(session_file))
        if not session_path.is_absolute():
            session_path = (index_file.parent / session_path).resolve()
    else:
        session_path = None

    updated_at = _safe_int(meta.get("updatedAt"))
    last_seen_at = _safe_int(meta.get("lastSeenAt"))
    sort_ts = updated_at or last_seen_at

    return {
        "id": archive_id,
        "uid": archive_id,
        "key": meta.get("key"),
        "agentId": meta.get("agentId") or "unknown",
        "updatedAt": updated_at,
        "sortAt": sort_ts,
        "sessionId": meta.get("sessionId"),
        "kind": _infer_session_kind(str(meta.get("key") or ""), meta.get("kind")),
        "model": meta.get("model"),
        "displayName": meta.get("displayName"),
        "channel": meta.get("channel"),
        "target": meta.get("target"),
        "sessionFile": str(session_path) if session_path else None,
        "storePath": str(index_file),
        "inputTokens": _safe_optional_int(meta.get("inputTokens")),
        "outputTokens": _safe_optional_int(meta.get("outputTokens")),
        "totalTokens": _safe_optional_int(meta.get("totalTokens")),
        "active": bool(meta.get("active")),
        "isArchived": not bool(meta.get("active")),
    }


def _sync_history_store(state_dir: Path, history_dir: Path) -> dict[str, Any]:
    history_dir.mkdir(parents=True, exist_ok=True)
    index_file = _history_index_path(history_dir)
    index_data = _load_history_index(state_dir, history_dir)
    active_slots = dict(index_data.get("activeSlots") or {})
    history_sessions = dict(index_data.get("sessions") or {})

    now_ms = int(time.time() * 1000)
    live_sessions = _load_live_session_meta(state_dir)
    seen_slots: set[str] = set()

    for session in live_sessions:
        agent_id = str(session.get("agentId") or "unknown")
        key = str(session.get("key") or "")
        slot_id = _stable_hash(agent_id.lower(), key)
        session_signature = str(session.get("sessionId") or "").strip()
        if not session_signature:
            first_event_id = _peek_first_message_event_id(str(session.get("sessionFile") or ""))
            session_signature = f"path:{session.get('sessionFile') or ''}|first:{first_event_id}"
        archive_id = _stable_hash(slot_id, session_signature)
        seen_slots.add(slot_id)

        prev_archive_id = active_slots.get(slot_id)
        if prev_archive_id and prev_archive_id != archive_id:
            prev_meta = history_sessions.get(prev_archive_id)
            if isinstance(prev_meta, dict):
                prev_meta["active"] = False
                prev_meta["archivedAt"] = now_ms

        active_slots[slot_id] = archive_id

        archive_meta = history_sessions.get(archive_id)
        if not isinstance(archive_meta, dict):
            archive_meta = {
                "id": archive_id,
                "firstSeenAt": now_ms,
            }
            history_sessions[archive_id] = archive_meta

        archive_dir = history_dir / "sessions" / archive_id[:2] / archive_id
        archive_file = archive_dir / "events.jsonl"
        source_session_file = str(session.get("sessionFile") or "")

        source_size = _safe_int(archive_meta.get("sourceSize"), -1)
        source_mtime_ns = _safe_int(archive_meta.get("sourceMtimeNs"), -1)
        next_size = source_size
        next_mtime_ns = source_mtime_ns

        if source_session_file:
            source_path = Path(source_session_file)
            if source_path.is_file():
                try:
                    stat = source_path.stat()
                    next_size = _safe_int(stat.st_size, source_size)
                    next_mtime_ns = _safe_int(
                        getattr(stat, "st_mtime_ns", int(stat.st_mtime * 1_000_000_000)),
                        source_mtime_ns,
                    )
                except OSError:
                    next_size = source_size
                    next_mtime_ns = source_mtime_ns

                source_changed = (
                    (next_size != source_size)
                    or (next_mtime_ns != source_mtime_ns)
                    or (not archive_file.is_file())
                )
                if source_changed:
                    archive_dir.mkdir(parents=True, exist_ok=True)
                    try:
                        shutil.copyfile(source_path, archive_file)
                    except OSError:
                        pass

        archive_meta.update(
            {
                "id": archive_id,
                "slotId": slot_id,
                "signature": session_signature,
                "key": session.get("key"),
                "agentId": session.get("agentId"),
                "updatedAt": _safe_int(session.get("updatedAt")),
                "sessionId": session.get("sessionId"),
                "kind": session.get("kind"),
                "model": session.get("model"),
                "displayName": session.get("displayName"),
                "channel": session.get("channel"),
                "target": session.get("target"),
                "sessionFile": str(archive_file) if archive_file.is_file() else None,
                "sourceSessionFile": source_session_file or None,
                "sourceSize": next_size,
                "sourceMtimeNs": next_mtime_ns,
                "inputTokens": _safe_optional_int(session.get("inputTokens")),
                "outputTokens": _safe_optional_int(session.get("outputTokens")),
                "totalTokens": _safe_optional_int(session.get("totalTokens")),
                "active": True,
                "lastSeenAt": now_ms,
                "archivedAt": None,
            }
        )

    for slot_id, archive_id in list(active_slots.items()):
        if slot_id in seen_slots:
            continue
        active_slots.pop(slot_id, None)
        stale = history_sessions.get(archive_id)
        if isinstance(stale, dict):
            stale["active"] = False
            if not stale.get("archivedAt"):
                stale["archivedAt"] = now_ms

    active_ids = set(active_slots.values())
    for archive_id, meta in history_sessions.items():
        if not isinstance(meta, dict):
            continue
        is_active = archive_id in active_ids
        meta["active"] = is_active
        if is_active:
            meta["archivedAt"] = None
        elif not meta.get("archivedAt"):
            meta["archivedAt"] = now_ms

    payload = {
        "schemaVersion": HISTORY_SCHEMA_VERSION,
        "stateDir": str(state_dir),
        "historyDir": str(history_dir),
        "updatedAtMs": now_ms,
        "updatedAtIso": _iso_from_ms(now_ms),
        "activeSlots": active_slots,
        "sessions": history_sessions,
    }
    _write_json_atomic(index_file, payload)
    return payload


def _load_all_session_meta(state_dir: Path, history_dir: Path) -> list[dict[str, Any]]:
    state_key = str(state_dir.resolve())
    history_key = str(history_dir.resolve())
    now_ms = int(time.time() * 1000)

    with _HISTORY_LOCK:
        cached_state = str(_HISTORY_CACHE.get("stateDir") or "")
        cached_history = str(_HISTORY_CACHE.get("historyDir") or "")
        cached_at = _safe_int(_HISTORY_CACHE.get("syncedAtMs"), 0)
        cached_sessions = _HISTORY_CACHE.get("sessions")
        if (
            cached_state == state_key
            and cached_history == history_key
            and (now_ms - cached_at) < HISTORY_SYNC_INTERVAL_MS
            and isinstance(cached_sessions, list)
        ):
            return cached_sessions

        rows: list[dict[str, Any]] = []
        try:
            payload = _sync_history_store(state_dir, history_dir)
            index_file = _history_index_path(history_dir)
            sessions_map = payload.get("sessions") if isinstance(payload, dict) else {}
            if isinstance(sessions_map, dict):
                for archive_id, meta in sessions_map.items():
                    if not isinstance(meta, dict):
                        continue
                    row = _to_history_row(str(archive_id), meta, index_file)
                    if row:
                        rows.append(row)
        except OSError as exc:
            print(f"[clawview] history sync failed: {exc}")
            rows = _load_live_session_meta(state_dir)
        except json.JSONDecodeError as exc:
            print(f"[clawview] history sync failed: {exc}")
            rows = _load_live_session_meta(state_dir)

        rows.sort(
            key=lambda row: _safe_int(row.get("sortAt") or row.get("updatedAt"), 0),
            reverse=True,
        )
        _HISTORY_CACHE["stateDir"] = state_key
        _HISTORY_CACHE["historyDir"] = history_key
        _HISTORY_CACHE["syncedAtMs"] = now_ms
        _HISTORY_CACHE["sessions"] = rows
        return rows


def _iter_message_events(session_file: str | None):
    if not session_file:
        return

    path = Path(session_file)
    if not path.is_file():
        return

    with path.open("r", encoding="utf-8") as f:
        for raw_line in f:
            raw_line = raw_line.strip()
            if not raw_line:
                continue
            try:
                event = json.loads(raw_line)
            except json.JSONDecodeError:
                continue

            if event.get("type") != "message":
                continue

            payload = event.get("message")
            if not isinstance(payload, dict):
                continue

            yield event, payload


def _load_session_messages(session_file: str | None) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    for event, payload in _iter_message_events(session_file) or []:
        ts_raw = payload.get("timestamp") or event.get("timestamp")
        ts_ms = _to_ms(ts_raw)
        content = payload.get("content")
        text = _extract_readable_text(content)
        if len(text) > 25000:
            text = text[:25000] + "\n...[truncated]..."
        parts = _extract_message_parts(content)

        messages.append(
            {
                "id": event.get("id"),
                "timestamp": ts_raw,
                "timestampMs": ts_ms,
                "role": payload.get("role", "unknown"),
                "text": text,
                "parts": parts,
            }
        )

    return messages


def _peek_first_message_event_id(session_file: str | None) -> str:
    if not session_file:
        return ""
    path = Path(session_file)
    if not path.is_file():
        return ""
    try:
        with path.open("r", encoding="utf-8") as f:
            for raw_line in f:
                raw_line = raw_line.strip()
                if not raw_line:
                    continue
                try:
                    event = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue
                if event.get("type") != "message":
                    continue
                raw_id = event.get("id")
                if raw_id is None:
                    return ""
                return str(raw_id)
    except OSError:
        return ""
    return ""


def _token_delta_from_usage(usage: Any) -> int:
    if not isinstance(usage, dict):
        return 0

    total = usage.get("totalTokens")
    if isinstance(total, (int, float)):
        return int(total)

    input_tokens = usage.get("input")
    output_tokens = usage.get("output")
    if isinstance(input_tokens, (int, float)) or isinstance(output_tokens, (int, float)):
        return int(input_tokens or 0) + int(output_tokens or 0)
    return 0


def _load_bot_alias_patterns(
    state_dir: Path, sessions: list[dict[str, Any]]
) -> dict[str, list[re.Pattern[str]]]:
    alias_map: dict[str, set[str]] = defaultdict(set)

    for session in sessions:
        agent_id = str(session.get("agentId") or "").strip().lower()
        if agent_id:
            alias_map[agent_id].add(agent_id)

    config_path = state_dir / "openclaw.json"
    if config_path.is_file():
        try:
            cfg = json.loads(config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            cfg = {}

        agents = cfg.get("agents", {}).get("list", [])
        if isinstance(agents, list):
            for entry in agents:
                if not isinstance(entry, dict):
                    continue
                agent_id = str(entry.get("id") or "").strip().lower()
                if not agent_id:
                    continue
                alias_map[agent_id].add(agent_id)
                name = str(entry.get("name") or "").strip().lower()
                if name:
                    alias_map[agent_id].add(name)

        bindings = cfg.get("bindings", [])
        if isinstance(bindings, list):
            for binding in bindings:
                if not isinstance(binding, dict):
                    continue
                agent_id = str(binding.get("agentId") or "").strip().lower()
                if not agent_id:
                    continue
                match = binding.get("match") or {}
                if isinstance(match, dict):
                    account_id = str(match.get("accountId") or "").strip().lower()
                    if account_id:
                        alias_map[agent_id].add(account_id)

    patterns: dict[str, list[re.Pattern[str]]] = {}
    for agent_id, aliases in alias_map.items():
        compiled: list[re.Pattern[str]] = []
        for alias in sorted(aliases):
            if len(alias) < 2:
                continue
            escaped = re.escape(alias)
            if len(alias) <= 2:
                regex = rf"(?<![A-Za-z0-9_])@{escaped}(?![A-Za-z0-9_])"
            else:
                regex = rf"(?<![A-Za-z0-9_])@?{escaped}(?![A-Za-z0-9_])"
            compiled.append(re.compile(regex, re.IGNORECASE))
        if compiled:
            patterns[agent_id] = compiled

    return patterns


def _compute_stats(state_dir: Path, sessions: list[dict[str, Any]]) -> dict[str, Any]:
    by_agent: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            "sessions": 0,
            "messages": 0,
            "assistantMessages": 0,
            "userMessages": 0,
            "toolMessages": 0,
            "otherMessages": 0,
            "tokens": 0,
        }
    )
    active_hours: dict[int, int] = {h: 0 for h in range(24)}
    token_by_day: dict[str, int] = defaultdict(int)
    mention_edges: dict[tuple[str, str], int] = defaultdict(int)
    mention_samples: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)

    min_ts = 0
    max_ts = 0

    alias_patterns = _load_bot_alias_patterns(state_dir, sessions)

    for session in sessions:
        session_key = str(session.get("key") or "")
        agent_id = str(session.get("agentId") or "unknown")
        agent_key = agent_id.lower()
        by_agent[agent_id]["sessions"] += 1

        fallback_usage_tokens = 0

        for event, payload in _iter_message_events(session.get("sessionFile")) or []:
            role = str(payload.get("role") or "unknown")
            by_agent[agent_id]["messages"] += 1
            if role == "assistant":
                by_agent[agent_id]["assistantMessages"] += 1
            elif role == "user":
                by_agent[agent_id]["userMessages"] += 1
            elif role == "toolResult":
                by_agent[agent_id]["toolMessages"] += 1
            else:
                by_agent[agent_id]["otherMessages"] += 1

            ts_raw = payload.get("timestamp") or event.get("timestamp")
            ts_ms = _to_ms(ts_raw)
            if ts_ms > 0:
                hour = datetime.fromtimestamp(ts_ms / 1000).hour
                active_hours[hour] += 1
                if min_ts == 0 or ts_ms < min_ts:
                    min_ts = ts_ms
                if ts_ms > max_ts:
                    max_ts = ts_ms

            if role == "assistant":
                plain = _extract_plain_text(payload.get("content"))
                if plain:
                    matched_targets: set[str] = set()
                    for target_id, patterns in alias_patterns.items():
                        if target_id == agent_key:
                            continue
                        if any(pattern.search(plain) for pattern in patterns):
                            matched_targets.add(target_id)

                    for target_id in matched_targets:
                        edge_key = (agent_id, target_id)
                        mention_edges[edge_key] += 1
                        bucket = mention_samples[edge_key]
                        if len(bucket) < 18:
                            bucket.append(
                                {
                                    "sessionKey": session_key,
                                    "sessionUid": session.get("uid"),
                                    "messageId": event.get("id"),
                                    "timestampMs": ts_ms,
                                    "timestampIso": _iso_from_ms(ts_ms),
                                    "excerpt": _truncate(" ".join(plain.split()), 220),
                                }
                            )

            token_delta = _token_delta_from_usage(payload.get("usage"))
            if token_delta > 0:
                fallback_usage_tokens += token_delta

        meta_total = _safe_optional_int(session.get("totalTokens"))
        updated_at = _safe_int(session.get("updatedAt"), 0)
        if meta_total and meta_total > 0:
            by_agent[agent_id]["tokens"] += meta_total
            if updated_at > 0:
                day = datetime.fromtimestamp(updated_at / 1000, tz=timezone.utc).strftime(
                    "%Y-%m-%d"
                )
                token_by_day[day] += meta_total
        elif fallback_usage_tokens > 0:
            by_agent[agent_id]["tokens"] += fallback_usage_tokens
            if updated_at > 0:
                day = datetime.fromtimestamp(updated_at / 1000, tz=timezone.utc).strftime(
                    "%Y-%m-%d"
                )
                token_by_day[day] += fallback_usage_tokens

    by_agent_rows = [
        {"agentId": agent, **counts}
        for agent, counts in sorted(
            by_agent.items(), key=lambda item: item[1]["messages"], reverse=True
        )
    ]

    mention_rows = [
        {
            "from": src,
            "to": dst,
            "count": count,
            "samples": mention_samples.get((src, dst), []),
        }
        for (src, dst), count in sorted(
            mention_edges.items(), key=lambda item: item[1], reverse=True
        )
    ]

    mention_nodes = [
        {
            "id": row["agentId"],
            "messages": row["messages"],
            "sessions": row["sessions"],
        }
        for row in by_agent_rows
    ]

    active_hour_rows = [
        {"hour": hour, "count": active_hours[hour]} for hour in sorted(active_hours.keys())
    ]

    token_rows = [
        {"date": day, "tokens": token_by_day[day]} for day in sorted(token_by_day.keys())
    ]

    total_messages = sum(row["messages"] for row in by_agent_rows)
    total_tokens = sum(row["tokens"] for row in by_agent_rows)
    active_sessions = sum(1 for s in sessions if bool(s.get("active")))
    archived_sessions = max(0, len(sessions) - active_sessions)

    return {
        "generatedAt": datetime.now(tz=timezone.utc).isoformat(),
        "totals": {
            "sessions": len(sessions),
            "activeSessions": active_sessions,
            "archivedSessions": archived_sessions,
            "agents": len(by_agent_rows),
            "messages": total_messages,
            "tokens": total_tokens,
        },
        "activeRange": {
            "fromMs": min_ts,
            "toMs": max_ts,
            "fromIso": _iso_from_ms(min_ts),
            "toIso": _iso_from_ms(max_ts),
        },
        "byAgent": by_agent_rows,
        "activeHours": active_hour_rows,
        "tokenTrend": token_rows,
        "mentionNodes": mention_nodes,
        "mentionEdges": mention_rows,
    }


def _search_messages(
    sessions: list[dict[str, Any]], q: str, limit: int
) -> dict[str, Any]:
    terms = [term.lower() for term in re.split(r"\s+", q.strip()) if term]
    if not terms:
        return {"query": q, "terms": [], "count": 0, "results": []}

    rows: list[dict[str, Any]] = []

    for session in sessions:
        session_key = str(session.get("key") or "")
        agent_id = str(session.get("agentId") or "unknown")
        for event, payload in _iter_message_events(session.get("sessionFile")) or []:
            text = _extract_readable_text(payload.get("content"))
            if not text:
                continue
            lower = text.lower()
            if not all(term in lower for term in terms):
                continue

            ts_raw = payload.get("timestamp") or event.get("timestamp")
            ts_ms = _to_ms(ts_raw)
            rows.append(
                {
                    "sessionKey": session_key,
                    "sessionUid": session.get("uid"),
                    "agentId": agent_id,
                    "sessionId": session.get("sessionId"),
                    "messageId": event.get("id"),
                    "role": payload.get("role", "unknown"),
                    "timestamp": ts_raw,
                    "timestampMs": ts_ms,
                    "timestampIso": _iso_from_ms(ts_ms),
                    "snippet": _make_excerpt(text, terms),
                }
            )

    rows.sort(key=lambda row: row.get("timestampMs", 0), reverse=True)
    return {
        "query": q,
        "terms": terms,
        "count": len(rows),
        "results": rows[:limit],
    }


def _recent_messages(
    sessions: list[dict[str, Any]], since_ms: int, limit: int
) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    max_ts = since_ms

    for session in sessions:
        session_key = str(session.get("key") or "")
        agent_id = str(session.get("agentId") or "unknown")
        for event, payload in _iter_message_events(session.get("sessionFile")) or []:
            ts_raw = payload.get("timestamp") or event.get("timestamp")
            ts_ms = _to_ms(ts_raw)
            if ts_ms <= 0 or ts_ms < since_ms:
                continue

            text = _extract_readable_text(payload.get("content"))
            rows.append(
                {
                    "sessionKey": session_key,
                    "sessionUid": session.get("uid"),
                    "agentId": agent_id,
                    "sessionId": session.get("sessionId"),
                    "messageId": event.get("id"),
                    "role": payload.get("role", "unknown"),
                    "timestamp": ts_raw,
                    "timestampMs": ts_ms,
                    "timestampIso": _iso_from_ms(ts_ms),
                    "text": _truncate(text, 600),
                }
            )
            if ts_ms > max_ts:
                max_ts = ts_ms

    rows.sort(key=lambda row: row.get("timestampMs", 0))
    if len(rows) > limit:
        rows = rows[-limit:]

    return {
        "sinceMs": since_ms,
        "nextSinceMs": max_ts,
        "count": len(rows),
        "messages": rows,
    }


def _to_export_markdown(session: dict[str, Any], messages: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    lines.append(f"# OpenClaw Session Export: {session.get('key', '-')}")
    lines.append("")
    lines.append("## Metadata")
    lines.append("")
    lines.append(f"- Agent: `{session.get('agentId') or '-'}`")
    lines.append(f"- Session ID: `{session.get('sessionId') or '-'}`")
    lines.append(f"- Kind: `{session.get('kind') or '-'}`")
    lines.append(f"- Model: `{session.get('model') or '-'}`")
    lines.append(f"- Channel: `{session.get('channel') or '-'}`")
    lines.append(f"- Updated At: `{_iso_from_ms(_safe_int(session.get('updatedAt'))) or '-'}`")
    lines.append(f"- Message Count: `{len(messages)}`")
    lines.append("")
    lines.append("## Messages")

    for idx, msg in enumerate(messages, start=1):
        ts_ms = _safe_int(msg.get("timestampMs"), 0)
        ts = _iso_from_ms(ts_ms) or str(msg.get("timestamp") or "-")
        role = str(msg.get("role") or "unknown")
        text = str(msg.get("text") or "").strip() or "(empty)"
        lines.append("")
        lines.append(f"### {idx}. {role} @ {ts}")
        lines.append("")
        lines.append("```")
        lines.append(text)
        lines.append("```")

    lines.append("")
    return "\n".join(lines)


class ClawViewHandler(SimpleHTTPRequestHandler):
    state_dir: Path = Path.home() / ".openclaw"
    history_root: Path = DEFAULT_HISTORY_ROOT
    history_dir: Path = _resolve_history_dir(DEFAULT_HISTORY_ROOT)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        static_dir = Path(__file__).resolve().parent / "static"
        super().__init__(*args, directory=str(static_dir), **kwargs)

    def _send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_text(
        self,
        text: str,
        status: int = 200,
        content_type: str = "text/plain; charset=utf-8",
        filename: str | None = None,
    ) -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(body)

    def _find_session(
        self,
        sessions: list[dict[str, Any]],
        key: str | None = None,
        session_uid: str | None = None,
    ) -> dict[str, Any] | None:
        if session_uid:
            return next(
                (
                    s
                    for s in sessions
                    if str(s.get("uid") or s.get("id") or "") == str(session_uid)
                ),
                None,
            )
        if key:
            return next((s for s in sessions if s.get("key") == key), None)
        return None

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/api/health":
            self._send_json(
                {
                    "ok": True,
                    "stateDir": str(self.state_dir),
                    "historyRoot": str(self.history_root),
                    "historyDir": str(self.history_dir),
                }
            )
            return

        if parsed.path == "/api/sessions":
            sessions = _load_all_session_meta(self.state_dir, self.history_dir)
            active_count = sum(1 for s in sessions if bool(s.get("active")))
            payload = {
                "stateDir": str(self.state_dir),
                "historyRoot": str(self.history_root),
                "historyDir": str(self.history_dir),
                "count": len(sessions),
                "activeCount": active_count,
                "archivedCount": max(0, len(sessions) - active_count),
                "sessions": [
                    {
                        **session,
                        "updatedAtIso": _iso_from_ms(session.get("updatedAt", 0)),
                    }
                    for session in sessions
                ],
            }
            self._send_json(payload)
            return

        if parsed.path == "/api/stats":
            sessions = _load_all_session_meta(self.state_dir, self.history_dir)
            self._send_json(_compute_stats(self.state_dir, sessions))
            return

        if parsed.path == "/api/search":
            query = parse_qs(parsed.query)
            q = ((query.get("q") or [""])[0] or "").strip()
            limit = _query_int(query, "limit", default=200, min_value=1, max_value=2000)
            if not q:
                self._send_json(
                    {
                        "query": "",
                        "terms": [],
                        "count": 0,
                        "results": [],
                        "error": "Missing query parameter: q",
                    },
                    status=400,
                )
                return
            sessions = _load_all_session_meta(self.state_dir, self.history_dir)
            self._send_json(_search_messages(sessions, q, limit))
            return

        if parsed.path == "/api/recent":
            query = parse_qs(parsed.query)
            minutes = _query_int(query, "minutes", default=10, min_value=1, max_value=1440)
            limit = _query_int(query, "limit", default=500, min_value=1, max_value=3000)
            raw_since = (query.get("sinceMs") or [""])[0]
            if raw_since:
                since_ms = _safe_int(raw_since, 0)
            else:
                since_ms = int(time.time() * 1000) - minutes * 60 * 1000

            sessions = _load_all_session_meta(self.state_dir, self.history_dir)
            payload = _recent_messages(sessions, since_ms, limit)
            payload["minutes"] = minutes
            self._send_json(payload)
            return

        if parsed.path == "/api/session":
            query = parse_qs(parsed.query)
            key = (query.get("key") or [""])[0]
            session_uid = (query.get("id") or [""])[0]
            if not key and not session_uid:
                self._send_json({"error": "Missing query parameter: id or key"}, status=400)
                return

            sessions = _load_all_session_meta(self.state_dir, self.history_dir)
            selected = self._find_session(sessions, key=key, session_uid=session_uid)
            if not selected:
                selector = session_uid or key
                self._send_json({"error": f"Session not found: {selector}"}, status=404)
                return

            messages = _load_session_messages(selected.get("sessionFile"))
            role_counts: dict[str, int] = defaultdict(int)
            for msg in messages:
                role_counts[str(msg.get("role") or "unknown")] += 1

            self._send_json(
                {
                    "session": {
                        **selected,
                        "updatedAtIso": _iso_from_ms(selected.get("updatedAt", 0)),
                    },
                    "messageCount": len(messages),
                    "roleCounts": dict(role_counts),
                    "messages": messages,
                }
            )
            return

        if parsed.path == "/api/session/export":
            query = parse_qs(parsed.query)
            key = (query.get("key") or [""])[0]
            session_uid = (query.get("id") or [""])[0]
            fmt = ((query.get("format") or ["json"])[0] or "json").lower()
            if not key and not session_uid:
                self._send_json({"error": "Missing query parameter: id or key"}, status=400)
                return

            sessions = _load_all_session_meta(self.state_dir, self.history_dir)
            selected = self._find_session(sessions, key=key, session_uid=session_uid)
            if not selected:
                selector = session_uid or key
                self._send_json({"error": f"Session not found: {selector}"}, status=404)
                return

            messages = _load_session_messages(selected.get("sessionFile"))
            export_payload = {
                "session": {
                    **selected,
                    "updatedAtIso": _iso_from_ms(selected.get("updatedAt", 0)),
                },
                "messageCount": len(messages),
                "messages": messages,
            }

            export_key = str(selected.get("uid") or selected.get("id") or key or "session")
            safe_key = re.sub(r"[^A-Za-z0-9._-]+", "_", export_key)
            if fmt == "md":
                md = _to_export_markdown(selected, messages)
                self._send_text(
                    md,
                    content_type="text/markdown; charset=utf-8",
                    filename=f"{safe_key}.md",
                )
                return
            if fmt == "json":
                body = json.dumps(export_payload, ensure_ascii=False, indent=2)
                self._send_text(
                    body,
                    content_type="application/json; charset=utf-8",
                    filename=f"{safe_key}.json",
                )
                return

            self._send_json({"error": "Unsupported format. Use json or md."}, status=400)
            return

        if parsed.path == "/":
            self.path = "/index.html"
        super().do_GET()


def main() -> None:
    args = parse_args()
    state_dir = Path(args.state_dir).expanduser().resolve()
    history_root = _resolve_history_root(args.history_root)
    history_dir = _resolve_history_dir(history_root)
    ClawViewHandler.state_dir = state_dir
    ClawViewHandler.history_root = history_root
    ClawViewHandler.history_dir = history_dir

    server = ThreadingHTTPServer((args.host, args.port), ClawViewHandler)
    url = f"http://{args.host}:{args.port}"
    print(f"[clawview] state dir: {state_dir}")
    print(f"[clawview] history  : {history_dir}")
    print(f"[clawview] server    : {url}")
    print("[clawview] press Ctrl+C to stop")

    if args.open:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[clawview] shutting down...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
