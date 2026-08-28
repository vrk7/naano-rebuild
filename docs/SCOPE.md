# Scope

What gets built for real, what gets faked, what gets cut. The data model and
the flow are in `PRODUCT.md`.

The test for everything below is the one claim: *point at a post, see the
people and companies it brought in, and whether they match an ICP.*

## The decision everything else hangs on

**LinkedIn does not give you the list of people who reacted to a post.** No
public API returns reactor or commenter identities on someone else's post.

Naano does not have one either. The creator card credits **Apify** for its
public profile data (`creator/08`), and the creator analytics page says "No
personal LinkedIn connection is required" (`creator/14`). Both mean scraping.

So the lead layer — the thing the product is *for* — rests on data that cannot
be obtained legitimately through an API, by us or by them. Three options:

1. Build a scraper. Out of scope: it is the whole project, it is fragile, and
   it is a legal question rather than an engineering one.
2. Drop the lead layer. Then there is no product left to build.
3. **Simulate the engagement feed behind an interface a scraper could later
   implement.** Chosen.

This is the largest fake in the build and it is load-bearing. Every demo of the
post-to-leads screen is running on generated people. That has to be said out
loud on the screen itself, not just in this file — the seeded data carries a
`source` of `seed` and the UI labels it.

## Build

Real code, real tests, no shortcuts.

- **The role picker.** One screen — brand or creator — and then a branch. It is
  the clearest screen naano has (`brand/01`) and the front door of a two-sided
  product; cutting it, as an earlier version of this file did, made the second
  side of the product look like a setting on a signup form.
- **Creator signup, in one screen.** Profile URL, up to three industries, price.
  naano spends five screens here (`creator/01`–`creator/06`) and four of them
  collect things nothing reads: a country prefilled from a scrape, a bundle, and
  an optional professional-information step about registered activity and
  invoicing for payouts that are cut below. What is left is what a marketplace
  listing is made of.
- **Auth, workspace, membership, RLS.** Two roles, owner and admin. Access
  control is one of the four things `CLAUDE.md` requires tests for.
- **ICP editor.** Structured targets — roles, seniorities, industries, geos —
  as editable chips. The enabling change from `PRODUCT.md`; without it there is
  no score.
- **One topic taxonomy**, shared by creator topics, ICP targets, brand industry
  and marketplace filters. Fixes naano's two-vocabulary drift (`creator/03` vs
  `brand/36`).
- **Match scoring engine.** Pure functions over `audience_facet` and
  `icp_target`. Returns value, confidence and a per-dimension breakdown.
  Unit tested, including the cases that matter: a creator who should score low,
  a creator with too small a sample, an ICP that targets only two dimensions.
- **Marketplace** — scoped to a campaign, sorted by score, low confidence last,
  low scores visible and labelled.
- **Creator profile** — breakdown table, audience facets with target sets
  marked, recent posts, rate.
- **Campaign and brief.** Both modes. `creative_freedom` is a real mode, not a
  disabled radio.
- **Collaboration state machine** with an append-only event log. Transitions
  and guards are tested; this is the first item on `CLAUDE.md`'s test list.
- **Draft submit / review / approve / request changes.**
- **Deterministic draft checks** against `brief.requirements`, each citing the
  span it judged.
- **Publish** — creator pastes the post URL, we record the post.
- **The post page** — engagements, people, companies, ICP matches, cost per
  engaged person, cost per ICP-matched person. This is the deliverable.
- **Leads table + CSV export**, source = post.
- **Wallet as a ledger** — topup, commit on accept, release on complete. Four
  entry kinds, no money moves.
- **A seeded demo workspace** with published posts and leads already on them.
  Naano's single worst property is that every surface is empty on arrival
  (`recon/NOTES.md` §6). Arriving at a populated product is a feature.

## Fake

Simulated, behind a named seam, replaceable without touching callers.

| What | How it is faked | Seam |
|---|---|---|
| Website → brand profile + ICPs | One LLM call over the pasted URL's text, or a fixture for known demo domains | `BrandIntelligenceProvider` |
| Creator population | Seed script, ~150 creators | `CreatorSource` |
| Audience snapshots | Generated per creator, with deliberate variety | `CreatorSource` |
| Engagement on a published post | Sampler that draws people from the creator's own audience distribution over ~5 days | `EngagementSource` |
| Person → company resolution | Generated companies with industry and country | `EngagementSource` |
| LinkedIn publishing | Creator pastes a URL. No API. | — |
| Wallet top-up | Button writes a `topup` ledger row | — |
| Model-judged draft checks | Real call, strict schema, stub mode for tests | `DraftReviewer` |

Two of these need saying properly.

**Seeded creators must include bad matches.** If every seeded creator scores
80+, the score is untested and the demo is a lie of the same kind naano tells.
The seed deliberately includes creators whose audience is in the wrong region,
the wrong seniority, or the wrong industry for the seeded ICPs — including at
least one who looks excellent on followers and CPM and scores in the thirties.
That case is the product's argument in a single row.

**The engagement sampler draws from the creator's audience snapshot.** Not from
a global pool. If a creator's audience is 43% India, the people who engage with
their post are ~43% India, and the ICP match rate comes out low on its own,
without anything being rigged to make the point. The simulation is only
plausible if it is downstream of the same data the score reads.

`EngagementSource` is the interface a real scraper implements later. It takes a
post and returns engagements with person and company attached. Nothing above it
knows the difference.

## Cut

Not "later" — not built. Each with the reason.

- **Creator earnings, payouts, invoices, bank details, Stripe.** A large,
  solved, entirely conventional surface (`creator/15`, `creator/27`,
  `creator/34`–`37`). Money movement is orthogonal to whether a post produced
  pipeline. The ledger records commitments; nothing leaves.
- **Affiliate program, Deal Link, referral attribution, leaderboard.** Growth
  mechanics (`creator/28`–`creator/32`). Four screens and a second attribution
  model that has nothing to do with the first.
- **Community, Slack, the campaign leaderboard** (`creator/24`, `creator/25`).
- **Externally managed / agency campaigns** (`creator/21`). These void
  attribution by definition — contracting, communication and payment happen off
  platform. Building the one thing that cannot demonstrate the claim would be
  perverse.
- **Negotiation and counter-offers.** naano has discount presets and a custom
  price (`brand/14`); whether a creator can counter is `NOT SEEN`. One price,
  accept or decline. Counter-offers add states to the machine without testing
  the thesis.
- **Bundles.** Multiplies the pricing and booking surface. One rate: single
  post. `creator_rate.kind` exists so this can come back without a migration.
- **Messaging.** Both sides gate a thread on a booking (`brand/26`,
  `creator/33`). The collaboration page carries state, a note on every event,
  and the request-changes note. A chat inbox is its own product.
- **Multi-workspace switching and team invitations** (`brand/30`, `brand/23`).
  One workspace per account, seeded members.
- **Guided tours, onboarding checklists, nudge toasts.** naano runs three at
  once and they collide — on `brand/15` a tour popover covers the form it is
  describing and truncates its own text. Ship none. A populated demo workspace
  does the job a tour is trying to do.
- **The creator's own analytics dashboard** (`creator/13`, `creator/14`). The
  creator sees their collaborations and their drafts. Their performance page
  serves the creator's interests, not the claim.
- **The creator's public marketplace card as a shareable artifact** — the flip
  animation, the preview, the share sheet (`creator/07`–`creator/09`). Nice,
  and irrelevant.
- **i18n.** naano ships EN/FR. English only.
- **Model-judged draft checks in v1.** An LLM scoring "brief adherence"
  produces a number nobody can dispute or act on, and it is the least
  differentiated thing we could build. The deterministic checks — required
  mentions, tracked link present, length band, disclosure, banned claims —
  catch the failures that actually recur, and each one can point at the span it
  judged. `DraftReviewer` exists so the model half can be added behind it.

## Order

Each step ends somewhere demonstrable.

1. **Schema, RLS, seed.** Topics, creators, audience snapshots, companies. The
   seed is the fixture everything else is tested against, so it comes first.
2. **Scoring engine.** Pure, tested, no UI. Includes the low-score and
   low-confidence cases.
3. **Role picker → the two signup branches → ICP editor.** The picker and the
   creator's one screen are small; the brand branch's faked generation and real
   ICP editing are the work.
4. **Marketplace + creator profile.** First point the thesis is visible: a
   ranked list where the ranking is legible and some entries score badly.
5. **Campaign + brief, both modes.**
6. **Collaboration state machine + event log.** Tested before any UI hangs off
   it.
7. **Draft, checks, review, approve, publish.**
8. **Engagement simulation → the post page.** The deliverable.
9. **Leads, export, wallet ledger.**

Steps 1–4 are the argument. If they do not hold up, the rest is not worth
building and stopping there costs a week rather than a month.

## What would sink this

- **The simulation is too clean and the post page is unconvincing.** The failure
  mode is generated people who all look plausible and all match. Mitigation: the
  sampler draws from the creator's real audience distribution, so a bad creator
  produces bad leads without intervention. If the screen still feels like a toy,
  the honest answer is that the claim needs real data and the rebuild cannot
  make it.
- **The weights and thresholds are unfalsifiable.** Four weights and two
  confidence thresholds in `PRODUCT.md` are stated guesses with nothing behind
  them. They are in one constant each. The risk is that they never get
  calibrated and quietly become the same arbitrary number naano ships — just
  ours.
- **Scoring is only as good as the ICP the brand entered.** We moved the ICP
  from prose to structured targets, which makes it scoreable and also makes it
  a form. If brands fill it in badly, the score is confidently wrong, which is
  worse than absent. The generated defaults have to be good enough that editing
  is optional in practice.
- **Two open questions could reframe this.** naano's Leads & Analytics **Posts**
  tab and Settings → **Measurement** were never opened (`recon/NOTES.md`). If
  one of them already is the post-to-leads view, we are building a better
  version of an existing screen, not a missing one. It does not change the build
  — it changes the pitch.
