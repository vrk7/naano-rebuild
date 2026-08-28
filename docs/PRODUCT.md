# Product

What we are building and why it is shaped this way. Evidence for claims about
the original product lives in `recon/NOTES.md` and the numbered screenshots.

## The one claim

A brand can point at a single published post and see the people who engaged
with it, the companies they work for, and which of its ICPs those companies
match.

Everything else exists to get a post published and to make that view honest.
If a feature does not serve that sentence, it is in `SCOPE.md` under cut.

## Three failures that drive the design

Evidence in `recon/NOTES.md` §5.

**The score cannot say no.** Every creator-side opportunity card reads 100%
match / 100/100 audience relevance — five visible, all identical (`creator/19`).
The brand side shows no number at all, just a "Matched 40" tab and a "Best
match" sort (`brand/09`). One side has a constant, the other has nothing.
→ *The score varies, is shown to both sides, and decomposes into the dimensions
that produced it.*

**The evidence contradicts the recommendation, one click away.** The first
card in "Matched 40 — Curated by Naano for Atira" is a creator whose audience is
43% India / 24% Pakistan / 8% Nigeria, 62% Founders, industry Marketing 26% /
AI 23% (`brand/09`, `brand/11`). Atira sells to Sales Engineering Managers at
industrial equipment manufacturers (`brand/07`, `brand/08`).
→ *The score reads the audience data, or the audience panel is decoration.*

**The ICP is prose.** Onboarding produces three paragraphs with theme chips
(`brand/06`–`brand/08`). You cannot score against a paragraph.
→ *The ICP is structured targets. The enabling change, invisible in the UI.*

## Data model

Postgres via Supabase. Names are table names. `→` is a foreign key.

### Tenancy and access

```
workspace          id, name, website, created_at
workspace_member   → workspace, → auth.users, role: owner | admin
```

Two roles only. RLS on every table keys off `workspace_member`. Access control
is one of the four things `CLAUDE.md` says to test.

### Brand side

```
brand_profile      → workspace (1:1)
                   company_name, website, tagline, value_prop,
                   industry_id → topic, size_band, source: auto | edited,
                   generated_at

icp                → workspace
                   rank (1..3), label, description,
                   is_active
icp_target         → icp
                   dimension: job_function | seniority | industry | geo
                   value    (topic_id for industry, ISO-3166 for geo,
                             enum for the rest)
                   weight   (0..1, defaults equal within a dimension)
```

`icp_target` is the whole reason the score works. An ICP is a set of typed
targets, not a paragraph. The paragraph stays as `icp.description` because it
is good input for brief generation and good for a human to read — it is just
not what the score reads.

### Creator side

```
creator            id, display_name, headline, avatar_url,
                   country, linkedin_url, followers, created_at
creator_topic      → creator, → topic          (max 3)
creator_rate       → creator, kind: single, price_cents, currency
                                                (bundles are cut — see SCOPE)

audience_snapshot  → creator
                   captured_at, sample_size, posts_analyzed,
                   source: seed | scrape
audience_facet     → audience_snapshot
                   dimension: job_function | seniority | industry | geo
                   value, share (0..1)
```

`audience_facet` rows sum to 1.0 within each dimension. Storing the audience
normalized — rather than as a blob on the creator — is what lets the score
decompose and show a per-dimension breakdown.

`sample_size` and `posts_analyzed` are carried deliberately. They gate whether
a score is shown at all.

```
creator_post       → creator
                   external_url, published_at, body,
                   impressions, reactions, comments, reposts,
                   is_sponsored, → collaboration (nullable)
```

### One taxonomy

```
topic              id, slug, label, kind: industry | function
```

naano runs two vocabularies: creators pick from ~28 industries (`creator/03`),
brands filter on about six (`brand/36`). A creator's third industry is
unreachable by any brand filter. One table, used by `creator_topic`,
`icp_target`, `brand_profile.industry_id` and the marketplace filters.

### Campaign and brief

```
campaign           → workspace
                   name, objective, status: draft | live | closed,
                   geos (ISO-3166[]), created_at

brief              → campaign (1:1)
                   mode: specific | creative_freedom
                   body (prose, may be one line)
                   requirements (jsonb, see below)
```

`requirements` is the structured half, and it is what the draft checks read:

```jsonc
{
  "must_mention":     ["Atira", "RFQ turnaround"],
  "must_include_link": true,
  "banned_claims":    ["guaranteed", "fastest in the world"],
  "length":           { "min": 400, "max": 1800 },   // characters
  "requires_disclosure": true
}
```

Every field is optional. `creative_freedom` mode means `requirements` is `{}`
and the checks that read it all pass vacuously. This is the escape hatch naano
promises in a toast (`brand/37`) and then does not offer in the offer form
(`brand/14`).

### Collaboration

```
collaboration      → campaign, → creator, → workspace
                   state, price_cents, post_by (date), respond_by (timestamptz),
                   approval_required (bool), created_at, updated_at

collaboration_event → collaboration
                   from_state, to_state,
                   actor: brand | creator | system, actor_user_id,
                   note, at
```

`collaboration_event` is append-only. The "next action" and "needs action"
surfaces on both sides are computed from `state` plus whose turn it is — one
field, not two divergent inboxes.

```
draft              → collaboration
                   version (int), body, submitted_at, submitted_by
draft_check        → draft
                   rule_key, rule_label,
                   kind: deterministic | model,
                   status: pass | fail | warn,
                   evidence (text span from the draft), explanation
```

`draft_check.evidence` is required for any `fail`. A check that cannot point at
the span it is judging does not get to fail the draft.

```
post               → collaboration (1:1)
                   → creator_post, tracked_url, published_at
```

### Attribution

```
company            id, name, domain, industry_id → topic,
                   size_band, country
person             id, full_name, headline, role_title, seniority,
                   linkedin_url, → company

engagement         → post, → person
                   kind: reaction | comment | repost, occurred_at

icp_match          → person, → icp
                   score (0..100), reasons (jsonb)
```

A lead is a `person` with an `engagement` on a `post`. Its source is therefore
always a specific post, which is the whole claim. `company` is resolved from
the person, and `icp_match` is computed per person against each active ICP with
the same scoring code the marketplace uses.

### Money

```
wallet             → workspace (1:1), balance_cents
ledger_entry       → wallet
                   kind: topup | commit | release | refund,
                   amount_cents, → collaboration (nullable), at
```

Deliberately thin. See `SCOPE.md`.

## Match score

A pure function. No I/O, unit tested — this is "budget and projection math"
under `CLAUDE.md`'s testing rules.

```
score(creator, icp) -> { value: 0..100, confidence, breakdown[] }
```

For each dimension `d` in {job_function, seniority, industry, geo}:

```
targets(d)  = the set of icp_target values for that dimension
overlap(d)  = Σ audience_facet.share where facet.dimension = d
                                      and facet.value ∈ targets(d)
```

`overlap(d)` is a share of the observed audience, so it is already 0..1.

```
value = 100 × Σ w(d) × overlap(d)
```

Starting weights:

| dimension | weight |
|---|---|
| job_function | 0.30 |
| industry | 0.25 |
| geo | 0.25 |
| seniority | 0.20 |

**These four numbers are a guess.** Nothing was measured. They encode an
opinion — that who the audience is matters slightly more than where it is — and
they are wrong in some way we cannot yet name. They live in one constant and
get calibrated once there is a single campaign with real outcomes to calibrate
against.

A dimension with no ICP targets is dropped and the remaining weights are
renormalized, so an ICP that only specifies roles and geos still scores.

### Confidence, and refusing to answer

```
confidence = low    if sample_size < 100 or posts_analyzed < 10
             medium if sample_size < 400 or posts_analyzed < 25
             high   otherwise
```

**Also a guess**, anchored on one real observation: naano prints a confident
number off 49 engagers and 5 posts (`brand/10`, `brand/11`). Those thresholds
are set above that so the failure we are correcting cannot be reproduced. They
are a placeholder for a real answer about sampling error.

At `low`, the UI shows "Not enough data" and the creator sorts last. It does
not show a greyed-out number, because a number shown at all is a number that
gets quoted.

### Showing the working

The breakdown is part of the return value, not a separate endpoint:

```jsonc
[{ "dimension": "geo",
   "targets": ["DE", "FR", "NL", "GB"],
   "overlap": 0.04,
   "weight": 0.25,
   "contribution": 1.0,
   "detractor": "96% of this audience is outside your target regions" }]
```

The creator profile renders one row per dimension and, above them, the single
largest detractor in words. A brand should be able to read why a creator scored
31 without opening anything.

## Collaboration state machine

```
                    ┌──── decline ────► declined
                    │
invited ────────────┼──── expire ─────► expired          (system, respond_by)
                    │
                    └──── accept ─────► accepted
                                            │
                                            ▼
                                        drafting ◄──── request_changes ──┐
                                            │                            │
                        approval_required   │   !approval_required       │
                              ▼             │             ▼              │
                          in_review ◄───────┴────────► approved          │
                              │                            │             │
                              └──── approve ───────────────┤             │
                              │                            │             │
                              └──── request_changes ───────┼─────────────┘
                                                           │
                                                        publish
                                                           ▼
                                                       published
                                                           │
                                                  measurement window
                                                           ▼
                                                       completed
```

| from | to | actor | guard |
|---|---|---|---|
| invited | accepted | creator | `now < respond_by` |
| invited | declined | creator | — |
| invited | expired | system | `now >= respond_by` |
| accepted | drafting | system | immediate |
| drafting | in_review | creator | `approval_required` and draft submitted |
| drafting | approved | creator | `not approval_required` and draft submitted |
| in_review | approved | brand | — |
| in_review | changes_requested | brand | note required |
| changes_requested | drafting | creator | — |
| approved | published | creator | `post.external_url` present |
| published | completed | system | `now >= published_at + window` |
| any pre-`published` | cancelled | brand | — |

`respond_by` exists because naano's offer form says the creator "can accept or
decline it within …" and the sentence is cut off (`brand/15`). We are choosing
the number rather than inheriting it: **72 hours**, because it is long enough
to cover a weekend and short enough that a brand's budget is not committed for
a week on a creator who has gone quiet. No measurement behind it.

The measurement window is **14 days** after publish, matching the default
`post_by` horizon naano uses (`brand/14`). Also a guess — it is the point where
we stop attributing new engagements to the collaboration for the purpose of
marking it complete. Engagements arriving later still land on the post; they
just do not hold the collaboration open.

Derived, not stored:

```
needs_action(collab, viewer) =
  viewer is creator and state ∈ { invited, drafting, changes_requested, approved }
  viewer is brand   and state ∈ { in_review }
```

Both sides' tab counts come from this one function.

## Signup to a published post with leads on it

The path the product has to make walkable. Numbers are screens.

1. **Sign up.** Email, password, workspace name. No role picker — this build is
   brand-side; creators arrive by invitation to a collaboration.

2. **Website.** One field. We generate `brand_profile` and three `icp` rows with
   their `icp_target` sets. Generation is faked — see `SCOPE.md`.

3. **Confirm the ICPs.** The screen naano has, with one difference: the targets
   are editable chips, not prose. Roles, seniorities, industries, geos. This is
   the only onboarding step that cannot be skipped, because the score is
   worthless without it.

4. **Create a campaign.** Name, objective, geos. Then the brief: pick
   *specific* or *creative freedom*. Specific opens the requirements form.
   Creative freedom takes a single line of body text and moves on.

   The campaign exists before the marketplace. That is the fix for the dead end
   at `brand/14` — but the brief is allowed to be one line, so it is not a fix
   by ceremony.

5. **Marketplace, scoped to the campaign.** Each card carries the score, its
   confidence, and the top detractor. Sorted by score descending, `low`
   confidence last. Low scores are shown and labelled, not hidden — a score
   that only ever appears when it is high is the constant we are replacing.

6. **Creator profile.** The breakdown table. Audience facets per dimension with
   the target set marked. Recent posts. Rate.

7. **Book.** Price, `post_by`, `approval_required`. On send: `commit` ledger
   entry against the wallet, `collaboration` created in `invited`.

8. **Creator accepts.** → `drafting`. The creator sees the brief and writes a
   draft.

9. **Submit.** `draft_check` rows are written. Deterministic checks run against
   `brief.requirements`, each citing its span. The creator sees failures before
   the brand does and can revise.

10. **Review.** If `approval_required`, the brand sees the draft with its check
    results and either approves or requests changes with a note.

11. **Publish.** The creator publishes to LinkedIn themselves and pastes the
    URL. We record `post` with its `tracked_url`. → `published`.

12. **Engagement arrives.** Simulated — see `SCOPE.md`. Each engagement writes a
    `person`, resolves a `company`, and computes `icp_match`.

13. **The post page.** The screen this whole document exists for:

    - the post, its body and its published date
    - impressions, reactions, comments, reposts
    - **people who engaged** — name, role, seniority, company, which ICP they
      match and at what score
    - **companies** — rolled up from those people, with how many engaged
    - cost of the post, cost per engaged person, cost per ICP-matched person
    - a link back to the collaboration and the brief it was written against

14. **Leads.** The same data aggregated across every post, with `Source` being
    the post. Export to CSV.

15. **Completed.** After the window, `release` ledger entry, collaboration
    closes.

## Carried from recon, still unanswered

These are open questions from `recon/NOTES.md` that the design has to survive
either answer to.

- What is behind naano's Leads & Analytics **Posts** tab and Settings →
  **Measurement**? Both `NOT SEEN`. If Posts is already a post-to-leads view,
  step 13 is a better version of an existing screen rather than a new one. It
  does not change what we build.
- What does `Source` hold on a naano lead — post, campaign, or creator? Ours
  holds the post.
- Can a creator counter-offer? Ours cannot. One price, accept or decline.
