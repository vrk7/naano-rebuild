# Workflow

Short on purpose. Rules for code live in `CLAUDE.md`.

## Branch naming

```
<type>/<short-slug>
```

Same types as commits: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`,
`perf`, `ci`. Slug is two or three words, kebab-case, describing the outcome
rather than the file being touched.

```
feat/creator-onboarding
fix/budget-rounding
refactor/split-brief-form
```

## Branch or commit straight to master

Straight to `master` when the change is small, reversible, and unlikely to be
abandoned halfway:

- docs, notes, recon, config
- a self-contained fix you can hold in your head
- anything already proven to work

Branch when the change is exploratory or wide:

- a feature that will take more than a couple of commits
- a schema or data-model change
- swapping out a library or an approach
- anything you might want to throw away

The test is not size, it is **would binning this be annoying**. If abandoning
the work would mean unpicking it from `master`, branch first.

## Binning a bad direction cheaply

The point of branching is that a wrong turn costs a delete, not a revert.

Branch not pushed yet:

```
git checkout master
git branch -D feat/bad-idea
```

Branch pushed:

```
git checkout master
git push origin --delete feat/bad-idea
git branch -D feat/bad-idea
```

Keep one idea from it first:

```
git checkout master
git cherry-pick <sha>          # just that commit
git checkout feat/bad-idea -- path/to/file    # just that file
```

Committed something bad straight to `master` and not pushed:

```
git reset --hard HEAD~1        # gone
git reset --soft HEAD~1        # undo the commit, keep the changes staged
```

Already pushed to `master`: do not rewrite it. `git revert <sha>` — the history
stays honest, which matters here because `.agent-logs/` is part of the record.

Do not let a bad direction linger on a branch "in case". If it is worth keeping
it is worth a commit message; otherwise delete it and move on.

## Before pushing

- `npm test`
- read your own diff: `git diff master...HEAD`
- the pre-commit secret guard runs itself (`.githooks/README.md`)
