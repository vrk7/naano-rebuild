#!/usr/bin/env python3
"""Automatic prompt/response capture for the 8x assignment.

Wired in .claude/settings.json to two Claude Code lifecycle events:
  UserPromptSubmit -> `agent_log.py prompt`    (verbatim prompt, from the hook payload)
  Stop             -> `agent_log.py response`  (final assistant text, from the transcript)

Captures ONLY the prompt and the final response of each turn. Thinking blocks,
tool calls, tool results and sidechain (subagent) turns are deliberately excluded.

Entry headers are matched with the live session id and their following
timestamp/model lines, so a prompt that happens to *contain* the text
"[LOG_ENTRY ...]" (this assignment brief does) cannot corrupt the numbering.

Never blocks a turn: failures are recorded in .agent-logs/_capture-errors.log
and the hook still exits 0.
"""
import fcntl
import glob
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

AUTHOR = "vrk7"
TOOL = "claude-code"
LOG_DIRNAME = ".agent-logs"
ERROR_LOG = "_capture-errors.log"
MODEL_PENDING = "pending"
NO_TEXT = "[no final text response in this turn]"
FLUSH_WAIT_S = 5.0
FLUSH_POLL_S = 0.1
TURN_BOUNDARY = ("user",)


def utc_now():
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def project_dir(payload):
    return os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()


def log_dir(payload):
    d = os.path.join(project_dir(payload), LOG_DIRNAME)
    os.makedirs(d, exist_ok=True)
    return d


def record_error(payload, message):
    try:
        with open(os.path.join(log_dir(payload), ERROR_LOG), "a") as fh:
            fh.write(f"{utc_now()} {message}\n")
    except Exception:
        pass
    print(message, file=sys.stderr)


# --------------------------------------------------------------------------
# transcript reading
# --------------------------------------------------------------------------

def read_transcript(path):
    """Main-thread transcript entries only (subagent sidechains excluded)."""
    if not path or not os.path.exists(path):
        return []
    entries = []
    with open(path, errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get("isSidechain"):
                continue
            entries.append(d)
    return entries


def latest_model(entries):
    for d in reversed(entries):
        if d.get("type") == "assistant":
            model = (d.get("message") or {}).get("model")
            if model:
                return model
    return None


def final_response_text(entries):
    """Final assistant text of the turn: text blocks emitted after the last tool
    call, i.e. walk back from the end until a turn boundary is reached.

    Bounded by 'user' entries, which cover both real prompts and tool_result
    entries, so a turn ending without a closing text block reports that honestly
    instead of bleeding the previous turn's answer. Do NOT add 'last-prompt' to
    the boundary: Claude Code rewrites that marker *after* the final text, so it
    would break the walk immediately and blank every response."""
    chunks = []
    for d in reversed(entries):
        kind = d.get("type")
        if kind in TURN_BOUNDARY:
            break
        if kind != "assistant":
            continue
        content = (d.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        for block in reversed(content):
            if isinstance(block, dict) and block.get("type") == "text":
                if block.get("text", "").strip():
                    chunks.append(block["text"])
    if chunks:
        return "\n\n".join(reversed(chunks)).strip()
    return NO_TEXT


def load_transcript_for_stop(path):
    """Read the transcript, waiting for the turn's final assistant message.

    Why this wait exists: the Stop hook can fire before Claude Code has flushed
    the closing assistant message to the transcript JSONL. Observed in a headless
    `claude -p` canary run - at hook time the file contained zero assistant
    entries (the captured entry read `model: pending` and had no text), yet the
    same file held the full response a second later.

    It polls for a condition rather than sleeping a fixed amount, so a normal
    turn costs one read. Worst case is FLUSH_WAIT_S, paid only by a turn that
    genuinely ends without text; the hook timeout in settings.json is 20s.
    Without it, responses are silently lost whenever the flush loses the race.
    """
    entries = read_transcript(path)
    deadline = time.monotonic() + FLUSH_WAIT_S
    while final_response_text(entries) == NO_TEXT and time.monotonic() < deadline:
        time.sleep(FLUSH_POLL_S)
        entries = read_transcript(path)
    return entries


def last_user_prompt(entries):
    for d in reversed(entries):
        if d.get("type") == "user":
            content = (d.get("message") or {}).get("content")
            if isinstance(content, str) and content.strip():
                return content
    return None


# --------------------------------------------------------------------------
# log file structure
# --------------------------------------------------------------------------

def entry_re(session_id):
    """Entry headers, anchored to this session's id plus its two metadata lines."""
    sid = re.escape(session_id[:8])
    return re.compile(
        rf"^\[LOG_ENTRY type=(?P<kind>PROMPT|RESPONSE) num=(?P<num>\d+) session={sid}\]\n"
        rf"timestamp: (?P<ts>\S+)\n"
        rf"model: (?P<model>\S+)\n",
        re.M,
    )


def split_body(text, rx):
    """Everything from the first real entry header onward ('' if no entries)."""
    match = rx.search(text)
    return text[match.start():] if match else ""


def parse_entries(body, rx):
    return [m.groupdict() for m in rx.finditer(body)]


def backfill_model(body, rx, model):
    """Replace 'pending' with the real model inside entry headers only."""
    def repl(m):
        return m.group(0).replace(f"model: {MODEL_PENDING}\n", f"model: {model}\n")
    return rx.sub(repl, body)


def build_header(session_id, project, model, entries):
    prompts = [e for e in entries if e["kind"] == "PROMPT"]
    prompt_times = [e["ts"] for e in prompts]
    first = prompt_times[0] if prompt_times else ""
    last = prompt_times[-1] if prompt_times else ""
    date = first[:10] if first else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return (
        "---\n"
        f"session_id: {session_id}\n"
        f"date: {date}\n"
        f"author: {AUTHOR}\n"
        f"model: {model}\n"
        f"tool: {TOOL}\n"
        f"project: {project}\n"
        f"total_exchanges: {len(prompts)}\n"
        f"first_prompt_time: {first}\n"
        f"last_prompt_time: {last}\n"
        "---\n\n"
        f"# Session Log - {date}\n\n"
        f"Session: `{session_id[:8]}` | Project: `{project}` | Author: `{AUTHOR}`\n\n"
        "---\n\n"
    )


def session_file(directory, session_id):
    matches = sorted(glob.glob(os.path.join(directory, f"*_{session_id}.md")))
    return matches[0] if matches else None


def new_session_file(directory, session_id):
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    return os.path.join(directory, f"{stamp}_{session_id}.md")


def append_entry(path, session_id, project, kind, num, model, text, fill_model=None):
    rx = entry_re(session_id)
    with open(path, "a+") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        fh.seek(0)
        body = split_body(fh.read(), rx)
        if fill_model:
            body = backfill_model(body, rx, fill_model)
        body += (
            f"[LOG_ENTRY type={kind} num={num} session={session_id[:8]}]\n"
            f"timestamp: {utc_now()}\n"
            f"model: {model}\n\n"
            f"{text}\n\n\n"
        )
        header_model = fill_model or model
        header = build_header(session_id, project, header_model, parse_entries(body, rx))
        fh.seek(0)
        fh.truncate()
        fh.write(header + body)
        fcntl.flock(fh, fcntl.LOCK_UN)


def count_entries(path, session_id):
    if not path or not os.path.exists(path):
        return 0, 0
    rx = entry_re(session_id)
    with open(path) as fh:
        entries = parse_entries(split_body(fh.read(), rx), rx)
    return (sum(1 for e in entries if e["kind"] == "PROMPT"),
            sum(1 for e in entries if e["kind"] == "RESPONSE"))


# --------------------------------------------------------------------------
# hook handlers
# --------------------------------------------------------------------------

def handle_prompt(payload):
    session_id = payload.get("session_id") or "unknown-session"
    entries = read_transcript(payload.get("transcript_path"))
    prompt = payload.get("prompt")
    if prompt is None:
        prompt = last_user_prompt(entries)
        record_error(payload, "WARN no 'prompt' field in payload; fell back to transcript")
    if prompt is None:
        record_error(payload, "ERROR could not resolve prompt text; entry skipped")
        return
    directory = log_dir(payload)
    path = session_file(directory, session_id) or new_session_file(directory, session_id)
    prompts, _ = count_entries(path, session_id)
    append_entry(path, session_id, os.path.basename(project_dir(payload)), "PROMPT",
                 prompts + 1, latest_model(entries) or MODEL_PENDING, prompt)


def handle_response(payload):
    session_id = payload.get("session_id") or "unknown-session"
    directory = log_dir(payload)
    path = session_file(directory, session_id)
    if not path:
        record_error(payload, f"WARN Stop fired with no log file for session {session_id}")
        return
    prompts, responses = count_entries(path, session_id)
    if prompts <= responses:
        return  # no unanswered prompt (e.g. Stop fired twice) - do not duplicate
    entries = load_transcript_for_stop(payload.get("transcript_path"))
    model = latest_model(entries) or MODEL_PENDING
    append_entry(path, session_id, os.path.basename(project_dir(payload)), "RESPONSE",
                 responses + 1, model, final_response_text(entries), fill_model=model)


def main():
    payload = {}
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        mode = sys.argv[1] if len(sys.argv) > 1 else ""
        if mode == "prompt":
            handle_prompt(payload)
        elif mode == "response":
            handle_response(payload)
        else:
            record_error(payload, f"ERROR unknown mode {mode!r}")
    except Exception as exc:  # never block a turn on a capture failure
        record_error(payload, f"ERROR {type(exc).__name__}: {exc}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
