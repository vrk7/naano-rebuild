# Capture Test

Verification that automatic prompt/response capture is installed and firing on its
own, before any assignment work began.

## Setup

| | |
|---|---|
| **Tool** | Claude Code (CLI) `v2.1.247` |
| **Model** | `claude-opus-5` — single model, both planning and execution. No separate planner/executor split. A mid-build switch would be visible: the model name is written per entry, read from the transcript, not hardcoded. |
| **Automatic mechanism?** | Yes. Claude Code has a first-class hooks system configured in `.claude/settings.json`. It exposes lifecycle events including `UserPromptSubmit` (fires on every prompt) and `Stop` (fires at end of every turn). Both receive a JSON payload on stdin; `Stop` includes `transcript_path` pointing at the session JSONL. |

## Mechanism

**Config file changed:** `.claude/settings.json` (committed to the repo, so it applies
to anyone who clones it — not a machine-local setting).

**Script:** `.claude/hooks/agent_log.py` — one script, two modes.

```
UserPromptSubmit  ->  agent_log.py prompt     writes the verbatim prompt from the hook payload
Stop              ->  agent_log.py response   writes the final assistant text from the transcript
```

Nothing is manual. There is no command to remember to run. The hooks fire from
`settings.json` on every prompt and every end-of-turn, in any session opened in this
repo, including sessions that know nothing about how the hooks were installed.

**What is captured:** prompt (verbatim, in full), final response, UTC timestamp with
milliseconds, and model name per entry.

**What is deliberately not captured:** thinking blocks, tool calls, tool results,
intermediate narration between tool calls, and subagent (sidechain) turns. The
response extractor walks back from the end of the transcript to the last `user` entry
and keeps only `text` blocks, which is precisely "what came back at the end of the turn".

Two details worth stating because they were not obvious:

- **Entry headers are matched against the live session id plus their following
  `timestamp:`/`model:` lines.** A naive `^\[LOG_ENTRY` regex breaks on this
  assignment: the brief itself contains a `[LOG_ENTRY type=PROMPT num=1 ...]` example,
  so the moment it is pasted as a prompt it lands in the log body and inflates the
  entry count, corrupting numbering and the duplicate-suppression check.
- **`model: pending`** appears when a prompt is the first of a session, since no
  assistant message exists yet to read a model name from. The `Stop` hook backfills
  it with the real model when the response is written. It is a backfill of a
  placeholder, never an edit to captured text.

## Where the canaries landed

```
.agent-logs/2026-08-27_16-45-47_40ddb40f-e260-48a9-9576-439ba137ae66.md   <- first attempt, BROKEN (kept as evidence)
.agent-logs/2026-08-27_16-48-07_d5dc3a75-4dbb-45a3-a15f-5be772cec69a.md   <- canary 1, green
.agent-logs/2026-08-27_16-48-42_77cc734c-23aa-487e-bd48-29a6ad578dca.md   <- canary 2, green
```

Both green canaries ran in fresh, separate sessions. Neither session installed the
hooks — they were installed from a third session — which is the point: the hook is
installed in the repo, not in the session that created it.

## Canary 1 — session `d5dc3a75`, raw

```
---
session_id: d5dc3a75-4dbb-45a3-a15f-5be772cec69a
date: 2026-08-27
author: vrk7
model: claude-opus-5
tool: claude-code
project: naano-rebuild
total_exchanges: 1
first_prompt_time: 2026-08-27T16:48:07.781Z
last_prompt_time: 2026-08-27T16:48:07.781Z
---

# Session Log - 2026-08-27

Session: `d5dc3a75` | Project: `naano-rebuild` | Author: `vrk7`

---

[LOG_ENTRY type=PROMPT num=1 session=d5dc3a75]
timestamp: 2026-08-27T16:48:07.781Z
model: claude-opus-5

CAPTURE TEST — 8x assignment, Vysakh Ramakrishnan (session 2)


[LOG_ENTRY type=RESPONSE num=1 session=d5dc3a75]
timestamp: 2026-08-27T16:48:15.713Z
model: claude-opus-5

Session 2 acknowledged — I'm in `/Users/vrk7/Projects/naano-rebuild` (git repo on `master`, no commits yet; only `.agent-logs/` and `.claude/` present).

I don't have a task from that line alone. What do you want me to do — and what does "8x assignment" refer to?
```

## Canary 2 — session `77cc734c`, raw

```
---
session_id: 77cc734c-23aa-487e-bd48-29a6ad578dca
date: 2026-08-27
author: vrk7
model: claude-opus-5
tool: claude-code
project: naano-rebuild
total_exchanges: 1
first_prompt_time: 2026-08-27T16:48:42.776Z
last_prompt_time: 2026-08-27T16:48:42.776Z
---

# Session Log - 2026-08-27

Session: `77cc734c` | Project: `naano-rebuild` | Author: `vrk7`

---

[LOG_ENTRY type=PROMPT num=1 session=77cc734c]
timestamp: 2026-08-27T16:48:42.776Z
model: claude-opus-5

CAPTURE TEST — 8x assignment, Vysakh Ramakrishnan (session 3)


[LOG_ENTRY type=RESPONSE num=1 session=77cc734c]
timestamp: 2026-08-27T16:48:45.987Z
model: claude-opus-5

I see a capture test marker rather than a task. Nothing to build yet — what would you like me to do?
```

## What I tried first that did not work

Four failures, in the order I hit them. The first three were caught in a dry-run
harness; the fourth only showed up against a real session, which is why the canary
step exists.

**1. Duplicated header on every write.**
The frontmatter has to be rewritten each turn (`total_exchanges`, `last_prompt_time`
are counters). My first version stripped only the `---` frontmatter block before
rewriting, but the header also contains a `# Session Log` title and a `Session: ...`
line. Those survived the strip and were re-emitted, so the header doubled on turn 2
and would have kept growing. Fixed by treating "everything from the first real entry
header onward" as the body and regenerating the whole header.

**2. The assignment brief corrupts a naive entry parser.**
The brief contains a literal `[LOG_ENTRY type=PROMPT num=1 session=3f9c1a20]` example.
Pasted as a prompt, it becomes log body text, and a `^\[LOG_ENTRY` regex counts it as
a real entry — breaking numbering and the check that suppresses duplicate responses.
Fixed by anchoring the pattern to the live session id and requiring the
`timestamp:`/`model:` lines that follow a genuine header. Verified with a deliberately
adversarial prompt containing a fake entry marker.

**3. A "safety" guard I added with no real failure case, which broke everything.**
A synthetic test suggested the response walk-back could bleed the previous turn's text,
so I added `last-prompt` to the turn-boundary set alongside `user`. That was wrong on
two counts. The synthetic failure was an artifact of my own unfaithful test transcript
(it omitted the user entry that a real transcript always has), and `last-prompt` is not
a turn-start marker at all — Claude Code rewrites it *after* the final assistant text.
With it in the boundary set, the walk-back hit it immediately and blanked every single
response. Reverted to `user` only, with a comment in the code saying why it must not
be re-added.

**4. `Stop` can fire before the transcript is flushed.** *(the real one)*
The first live canary (session `40ddb40f`, kept in `.agent-logs/`) captured the prompt
correctly but recorded `model: pending` and `[no final text response in this turn]`.
The `model: pending` is what identified the cause: the model name is read by scanning
the whole transcript regardless of turn boundaries, so `pending` means there were *zero*
assistant entries in the file when the hook ran — not a parsing bug, a flush race. The
same file held the complete response a second later. Fixed with a bounded poll in
`load_transcript_for_stop()`: re-read until the turn's final text appears, up to 5s,
polling every 100ms. It waits on a condition rather than sleeping a fixed amount, so a
normal turn costs one read and only a turn that genuinely ends without text pays the
full 5s (the hook timeout is 20s). Without it, responses are silently dropped whenever
the flush loses the race — which is the worst possible failure for this log, because it
looks like it worked.

Note that failure 4 is invisible to a dry-run harness — my synthetic tests were all
green at the time it happened, because a synthetic transcript is written before the
hook runs, by construction. Only a real session surfaced it.

## Known limits

- If a turn ends without a closing text block (interrupted mid-tool-loop), the entry
  records `[no final text response in this turn]` rather than inventing one, and the
  prompt/response pairing is preserved.
- If a `Stop` fires with no unanswered prompt, no entry is written, so a repeated
  `Stop` cannot duplicate a response.
- Capture failures never block a turn. They are appended to
  `.agent-logs/_capture-errors.log`, which ships with the repo rather than being
  swallowed. It is absent when nothing has failed.
