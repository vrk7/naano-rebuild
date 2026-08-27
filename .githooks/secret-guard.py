#!/usr/bin/env python3
"""Block secrets from entering a commit.

Runs from .githooks/pre-commit. Scans the *staged* content of every added,
copied or modified file - not the working tree - so what is checked is exactly
what would be committed.

There is no path exclusion list, deliberately. .agent-logs/ is scanned like
everything else: those entries are public, ship with the repo, and must never be
edited after the fact, so a secret landing in one is permanent.

Findings are masked in the output. A guard that echoes the full secret into
terminal scrollback and CI logs is its own leak.

Fails closed: if a staged blob cannot be read, the commit is blocked rather than
waved through.

Escape hatch and rationale: .githooks/README.md
"""
import base64
import os
import re
import subprocess
import sys

ALLOW_MARKER = "secret-guard: allow"
DISABLE_VALUES = {"off", "0", "false", "no"}
MASK_HEAD = 4
MAX_BYTES = 5 * 1024 * 1024

ENV_FILE_RE = re.compile(r"^\.env(\..+)?$")
ENV_FILE_ALLOWED = {".env.example", ".env.sample", ".env.template"}

PATTERNS = [
    ("AWS access key id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b")),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b")),
    ("OpenAI / Anthropic style key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("Stripe key", re.compile(r"\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}\b")),
    ("Supabase secret key", re.compile(r"\bsb_secret_[A-Za-z0-9_\-]{16,}\b")),
    ("Supabase access token", re.compile(r"\bsbp_[a-f0-9]{40}\b")),
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
]

JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{6,}\b")

# NAME=value lines, i.e. .env contents pasted anywhere.
ASSIGN_RE = re.compile(
    r"^\s*(?:export\s+)?"
    r"(?P<name>[A-Z][A-Z0-9_]*"
    r"(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIALS?|SERVICE_ROLE)"
    r"[A-Z0-9_]*)"
    r"\s*=\s*(?P<val>\S+)\s*$"
)
# A real value: one opaque token. Anything with spaces or parens is code, not a secret.
VALUE_SHAPE_RE = re.compile(r"^['\"]?[A-Za-z0-9_\-./+=:@]{6,}['\"]?$")
PLACEHOLDER_RE = re.compile(
    r"^(?:x+|\*+|\.+|-+|\d+|null|none|undefined|true|false"
    r"|.*(?:your|example|placeholder|changeme|change_me|todo|dummy|fake|sample"
    r"|redacted|goes[_-]?here|<.*>|\$\{|process\.env).*)$",
    re.I,
)


def disabled():
    return os.environ.get("SECRET_GUARD", "").strip().lower() in DISABLE_VALUES


def git(args):
    """Run git, raising on failure - callers must not continue on a failed read."""
    proc = subprocess.run(["git"] + args, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed: {proc.stderr.decode(errors='replace').strip()}"
        )
    return proc.stdout


def staged_paths():
    out = git(["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"])
    return [p for p in out.decode(errors="replace").split("\0") if p]


def staged_blob(path):
    return git(["show", f":{path}"])


def mask(value):
    """Identify a match without reprinting it: prefix plus length."""
    text = value.strip("'\"")
    head = text[:MASK_HEAD]
    return f"{head}...[{len(text)} chars]"


def jwt_label(token):
    """Name a Supabase service_role JWT specifically - it is the dangerous one."""
    try:
        payload = token.split(".")[1]
        padded = payload + "=" * (-len(payload) % 4)
        claims = base64.urlsafe_b64decode(padded).decode(errors="replace")
    except Exception:
        return "JWT"
    if "service_role" in claims:
        return "Supabase SERVICE ROLE JWT (full database access)"
    return "JWT"


def scan_line(line):
    """All findings on one line, as (label, matched_text)."""
    if ALLOW_MARKER in line:
        return []
    found = []
    for label, rx in PATTERNS:
        for m in rx.finditer(line):
            found.append((label, m.group(0)))
    for m in JWT_RE.finditer(line):
        found.append((jwt_label(m.group(0)), m.group(0)))
    assign = ASSIGN_RE.match(line)
    if assign:
        value = assign.group("val")
        if VALUE_SHAPE_RE.match(value) and not PLACEHOLDER_RE.match(value.strip("'\"")):
            found.append((f"env assignment {assign.group('name')}=", value))
    return found


def scan_file(path):
    """Findings as (path, lineno, label, matched) - env filenames blocked outright."""
    name = os.path.basename(path)
    if ENV_FILE_RE.match(name) and name not in ENV_FILE_ALLOWED:
        return [(path, 0, "env file staged (never commit real env files)", name)]
    blob = staged_blob(path)
    if b"\0" in blob:
        return []
    if len(blob) > MAX_BYTES:
        return [(path, 0, f"file over {MAX_BYTES} bytes, not scanned - commit blocked", name)]
    findings = []
    for num, line in enumerate(blob.decode(errors="replace").splitlines(), 1):
        for label, matched in scan_line(line):
            findings.append((path, num, label, matched))
    return findings


def report(findings):
    print("", file=sys.stderr)
    print("BLOCKED: possible secrets in staged content", file=sys.stderr)
    print("", file=sys.stderr)
    current = None
    for path, num, label, matched in findings:
        if path != current:
            print(f"  {path}", file=sys.stderr)
            current = path
        where = f"line {num}" if num else "filename"
        print(f"    {where}: {label}  ->  {mask(matched)}", file=sys.stderr)
    print("", file=sys.stderr)
    print("  Matches are masked above on purpose.", file=sys.stderr)
    print("  Real secret?      remove it, then rotate the key - staging it is enough to assume it is burned.", file=sys.stderr)
    print("  False positive?   see .githooks/README.md (inline marker, or SECRET_GUARD=off).", file=sys.stderr)
    print("", file=sys.stderr)


def main():
    if disabled():
        print("secret-guard: DISABLED via SECRET_GUARD - nothing scanned", file=sys.stderr)
        return 0
    try:
        findings = [f for path in staged_paths() for f in scan_file(path)]
    except Exception as exc:
        # Fail closed: a guard that cannot read the index must not approve it.
        print(f"secret-guard: FAILED to scan ({type(exc).__name__}: {exc})", file=sys.stderr)
        print("secret-guard: blocking the commit rather than passing unchecked.", file=sys.stderr)
        return 1
    if not findings:
        return 0
    report(findings)
    return 1


if __name__ == "__main__":
    sys.exit(main())
