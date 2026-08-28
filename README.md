# naano-rebuild

A rebuild of a B2B LinkedIn creator marketplace, built to hold one claim:

> **Point at a post, see the people and companies it brought in, and whether they match an ICP.**

Everything here is judged against that sentence. A screen that does not help
make it true is not in the build.

The three documents that matter are [`docs/PRODUCT.md`](docs/PRODUCT.md) (the
data model and the fifteen-step flow), [`docs/SCOPE.md`](docs/SCOPE.md) (what is
built, what is faked, what is cut, and why), and
[`CAPTURE-TEST.md`](CAPTURE-TEST.md) (how the agent capture log is wired).

---

## The one thing to read before the code

**LinkedIn does not give you the list of people who reacted to a post.** No
public API returns reactor identities on someone else's post. The product this
rebuilds does not have one either — it credits a scraping vendor.

So the lead layer, the thing the product is *for*, rests on data that cannot be
obtained legitimately through an API. `SCOPE.md` takes the third of three
options: **simulate the engagement feed behind an interface a scraper could
later implement.**

That is the largest fake in the build and it is load-bearing. Every demo of the
post-to-leads screen runs on generated people. The simulation draws each engager
from the creator's own stored audience distribution — the same rows the match
score reads — so a creator whose audience is 43% India produces engagers who are
~43% India, and their ICP match rate comes out low on its own without being
rigged to make the point. Run against a representative mismatched audience —
43% India, 24% Pakistan, 4% Germany against a German industrial ICP — a
210k-follower creator returned **3% ICP-matched across 265 engagements**, with
the drawn distribution landing within a few points of the stored one.

Seeded and simulated data is labelled as such on screen, not only in this file.

---

## See it running

**https://naano-rebuild-cyan.vercel.app**

Two logins are attached to the seeded demo workspace, and their passwords are
published on purpose. Without them a reviewer has to register a brand, top up a
wallet, book a creator, write a draft and publish it before the screen this
build exists for has anything on it.

| Role | Email | Password |
|---|---|---|
| Brand | `demo@naano-rebuild.dev` | `naano-demo-public` |
| Creator | `demo+creator@naano-rebuild.dev` | `naano-demo-public` |

The brand owns *Atira Industrial*: three ICPs, two campaigns, five published
collaborations. The claim is quickest to check at `/brand/posts` — open the
post by **Ursula Jimenez** (376k followers, 251 engagements, **0** of them in
ICP) next to the one by **Gabriel Duarte** (38k followers, 238 in ICP at $5
each). `/brand/leads` aggregates every post; `/brand/wallet` shows the ledger
that explains the balance. The creator account holds one of those same
collaborations from the other side.

Both accounts are throwaway, on a project that holds nothing but seeded and
simulated rows, and `npm run db:seed:demo` recreates the workspace from scratch
— so anything a visitor does to it is one command from being undone.

---

## Running it

**Prerequisites:** Node 22.18+ (the seed scripts run TypeScript directly) and a
Supabase project. Docker only if you want a local database; everything below
works against a hosted one.

```bash
npm install
cp .env.example .env.local     # then fill it in — see the comments in that file

# `db:link` in package.json carries the original project ref. Point it at yours:
npx supabase login
npx supabase link --project-ref <your-project-ref>

npm run db:push                # applies every migration
npm run db:seed                # taxonomy + ~150 creators with audience snapshots
npm run db:seed:demo           # a demo brand workspace with published posts and leads
npm run dev
```

`db:seed` is the fixture everything is tested against and is required.
`db:seed:demo` is optional but is the fastest way to see the post page and the
leads table with data on them. It attaches the two logins above only when
`SEED_DEMO_EMAIL` and `SEED_DEMO_PASSWORD` are set — the script hardcodes no
credential, so your copy gets whatever password you give it, not this one.

**Signing up fresh instead:** the role picker at `/register` is the front door.
A brand gets an empty wallet, so top it up at `/brand/wallet` before booking.
Paste `atira.example` at the website step to use the built-in fixture rather
than spending a model call.

```bash
npm test          # 466 tests
npm run build
```

The access-control and wallet tests run against the real Supabase project,
because RLS and `security definer` functions are enforced by Postgres and a mock
would only test the mock. They skip cleanly when the env vars are absent. Every
row they create carries a run-scoped prefix and is deleted afterwards.

---

## What is built

`SCOPE.md`'s delivery order, all nine steps:

| | |
|---|---|
| 1 | Schema, RLS, seed — ~150 creators with deliberately varied audiences |
| 2 | Scoring engine — pure and tested, including the low-score and withheld cases |
| 3 | Role picker, both signup branches, the ICP editor |
| 4 | Marketplace and creator profile — the ranking, with its working shown |
| 5 | Campaigns and briefs, both modes |
| 6 | Collaboration state machine and event log, tested before any UI |
| 7 | Draft, deterministic checks, review, approve, publish |
| 8 | Engagement simulation → the post page |
| 9 | Leads, CSV export, wallet ledger |

Two properties the build is organised around:

**The score can say no.** Creators are scored 0–100 against the workspace's
ICPs, and plenty land in the thirties. Below a confidence floor the number is
withheld in words rather than shown greyed out, because a number shown at all is
a number that gets quoted. The breakdown table shows points won *and* points
lost per dimension, so "why is this 31" is answerable without opening anything.

**The ledger explains the balance.** No money moves. Booking writes a negative
`commit` and drops the balance; closing after the measurement window writes the
positive `release` that returns it. Both are written in the same transaction as
the balance they explain, and the tests assert that the balance always equals
the sum of its entries.

---

## Deliberately not built

`SCOPE.md` carries the full list with reasons. The ones most likely to be
noticed as absent:

- **Creator earnings, payouts, invoices, Stripe.** Large, solved, conventional,
  and orthogonal to whether a post produced pipeline.
- **A LinkedIn scraper.** See above. It is a legal question rather than an
  engineering one.
- **Counter-offers.** One price, accept or decline.
- **Dark mode.** Light-only by decision, not by omission — the `dark:` variant is
  kept pointed at a class nothing sets so vendored component styles stay inert
  rather than half-firing on a dark OS.

## Known gaps

Things that are incomplete rather than cut, stated because finding them yourself
would be worse:

- **System transitions have no runner.** `invited → expired` never fires, so a
  lapsed invitation still reads as invited and says so on screen rather than
  pretending otherwise. `published → completed` is reachable from the wallet
  page, which only ever *asks* whether a close is due — the database refuses
  anything still inside its window — but a cron would be its proper home.
- **Simulated engagers are per-post.** Nobody appears on two posts, so the leads
  table's cross-post aggregation is exercised by seeded data rather than by
  runtime data. Matching identities across posts would be a claim nothing
  supports.
- **`createBrandWorkspace` throws past its server action** into an error page
  instead of returning through `SetupState`, which already has a field the form
  renders. It surfaces on a stale session, which `db:seed:demo` can cause by
  deleting and recreating auth users while a browser still holds a cookie.
- **Model-judged draft checks** are stubbed in tests and need
  `GOOGLE_GENERATIVE_AI_API_KEY` to run for real. The deterministic checks need
  no key.

---

## Layout

```
docs/           PRODUCT.md, SCOPE.md, WORKFLOW.md — the decisions
recon/          notes on the product being rebuilt
src/lib/        scoring, state machine, queries, simulation — the logic, tested
src/components/ ui/ primitives first, then feature components
supabase/       migrations; RLS and security-definer functions live here
scripts/        seed and demo-seed
tests/          pure logic, plus access control against the real database
.agent-logs/    the agent capture log — committed on purpose, never edited
design-system/  the design tokens and the reasoning behind them
```

Conventions for anyone extending it are in [`CLAUDE.md`](CLAUDE.md): small
files, no swallowed errors, no empty-array fallbacks hiding a failure, and a
commit message that says *why* a magic number is that number — or admits it was
a guess.
