# Committed git hooks

These ship with the repo instead of living in `.git/hooks`, which is local-only
and would mean everyone else gets no protection.

## Activate

```
git config core.hooksPath .githooks
```

`npm install` does this for you via the `prepare` script. It is per-clone
config, so a fresh clone needs it once. Check with:

```
git config core.hooksPath   # expects: .githooks
```

## pre-commit — secret guard

`secret-guard.py` scans the **staged content** of every added/modified file and
blocks the commit if anything looks like a credential.

Caught:

- AWS access key ids, GitHub tokens (classic + fine-grained), Stripe keys,
  Google API keys, Slack tokens
- `sk-` style API keys (OpenAI, Anthropic)
- Supabase secret keys and personal access tokens
- Any JWT. A JWT whose payload decodes to a `service_role` claim is reported
  with a louder label, because that one is full database access
- `.env` contents pasted anywhere: `NAME=value` lines where the name looks
  secret-ish and the value is a real opaque token rather than a placeholder
- Private key blocks
- Staging a real `.env` file at all (`.env.example` / `.sample` / `.template`
  are fine)

Not caught, so do not rely on it for these: a secret with no recognisable
shape, a secret already committed in an earlier commit (this only sees what is
staged now), and anything inside a binary file.

### No path exclusions

There is no skip list. `.agent-logs/` is scanned like everything else, on
purpose: those entries are public, ship with the repo, and must never be edited
after the fact — so a secret landing in one cannot be cleaned up afterwards.

### Output is masked

The report prints the file, the line number, and what matched, but the value
itself is truncated to a short prefix plus a length. A guard that echoed the
full secret into terminal scrollback and CI logs would be its own leak.

### It fails closed

If the scanner cannot read the index, it blocks the commit instead of passing
it unchecked.

## Escape hatch

Two ways out, both deliberate.

**1. Inline marker** — for a line that is genuinely not a secret (a test
fixture, a docs example). Put this anywhere on the line:

```
secret-guard: allow
```

That line is then skipped. Prefer this: it is narrow and it stays visible in
the diff. It only works in files you are allowed to edit — not `.agent-logs/`.

**2. Whole-run bypass** — for a false positive you cannot annotate:

```
SECRET_GUARD=off git commit -m "..."
```

This prints a loud notice and scans nothing. Use it when the marker will not
work, and say why in the commit body.

`git commit --no-verify` also skips the hook, along with every other hook.
Prefer `SECRET_GUARD=off`: it names what is being turned off.

## If it fires on something real

Do not just unstage it. Staging a live credential means assuming it is burned:
remove it, then **rotate the key**. Do not weaken a pattern to get the commit
through.
