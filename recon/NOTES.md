# naano — recon notes

Hand-filled notes from walking through naano. Nothing in here is generated;
each section is filled in as I go.

- Date(s) of the walkthrough: 2026-08-27. Brand side 19:49–20:05, creator side
  20:07–20:15 (local, from screenshot timestamps).
- Build / URL / app version: `naano.com`. Signup at `naano.com/register`, brand
  role is `?role=saas`. Brand app at `naano.com/brand`. Public marketing site on
  the same domain. Version string: NOT SEEN.
- Accounts used (brand side, creator side):
  - Brand — "Jake Tick", workspace **Atira** (`atira.ai`), role Owner. Signed up
    with email + a disposable temp-mail address.
  - Creator — built from the public LinkedIn profile
    `linkedin.com/in/andrewyng` (Andrew Ng, 2,606,117 followers, United States).
- Screenshots: `recon/brand/`, `recon/creator/` — named in visit order,
  `01-<step>.png`, and referenced inline from the flow sections below.

Everything below is what was visible on screen. Where a screen was not captured
or text was cut off, it says **NOT SEEN** rather than a guess.

---

## 1. Brand flow

What a brand does, in the order it actually happens. One numbered step per
screen or decision point. Note what the screen asks for, what it does with the
answer, and where it can go next.

| # | Screen / step | What it asks for | Where it leads | Screenshot |
|---|---------------|------------------|----------------|------------|
| 1 | Role picker (`/register`) | "First, who are you here as?" — *I'm a creator* / *I'm a brand*. Brand copy: "Find creators, launch campaigns, and trace real pipeline back to each post." | Brand choice → `/register?role=saas` | `brand/01` |
| 2 | Sign-up options | Sign up with LinkedIn / Google / email | Email → sign-up form | `brand/02` |
| 3 | Sign-up form | First name, Last name, Business email, Password, "How did you hear about us?" (chips: LinkedIn, Word of mouth, Google search, A creator, Other) | Submit → "Sending your verification code…" | `brand/03` |
| 4 | Email verification | NOT SEEN (gap 19:51 → 19:55) | — | — |
| 5 | Onboarding step 1 of 2 — "Your website" | One field: website URL. "We'll read your site to understand the product and your 3 main ICPs. This usually takes 20–40 seconds." → *Analyze my website* | Site scrape → step 2 | `brand/04` |
| 6 | Onboarding step 2 of 2 — "Value prop & ICP" | Pre-filled from the scrape, editable: **Value proposition** (free text, "4 to 6 sentences") and **3 ideal customers (ICP)** — each ICP is a role title, a paragraph, and theme chips. "Confirm in 30 seconds. The rest (features, geos, extras) fills Settings in the background." | *Back* / *Go to my dashboard →* | `brand/05`–`brand/08` |
| 7 | Marketplace — "Matched" | Nothing required. Tabs *Matched 40* / *All creators 682* / *Saved 0*. Search, sort, filters. Banner "Naano is improving your shortlist — AI is refining your matches using recent creator performance…". Guided tour 1/3. | Creator card → profile drawer; *Book* → booking flow | `brand/09` |
| 8 | Marketplace filters | Industry (checkbox list: AI, Data, Marketing, SEO, Content, Sales, …), Country (searchable checkbox list, full country list), Price (histogram + range slider, €50 – €10450+, "price per sponsored post"), Filters → "Performance filters" (Maximum CPM, Minimum median views, Minimum followers, Maximum followers, Minimum engagement %, Posted recently). Sort by: Best match / Price: low to high / Most followers / Best engagement. | Narrows the grid. "These filters hide creators; matching scores stay unchanged." | `brand/33`–`brand/37` |
| 9 | Creator profile — Overview | Read-only. Two headline checks ("37% in observed audience · Marketing", "86.3K typical reach"), Audience snapshot (job title, seniority), Content performance (reach sparkline + an embedded public LinkedIn post with views/reactions/comments/reposts), collapsed "Professional profile". Right rail *Book this creator*. Tour 2/3. | *Collaborate with <creator>* → selection modal | `brand/10` |
| 10 | Creator profile — Audience | Read-only. "Audience composition — Top segments by dimension; each bar compares like with like", "Estimated from 49 recent public engagers · Observed engaged profiles 49". Job title / Seniority / Industry / Audience geography. Expander "See the full audience — 18 audience signals". | — | `brand/11` |
| 11 | Creator profile — Content | Read-only. "Content signals" — topic chips, Latest post, Estimated cadence, Typical range, Posts analyzed, reach sparkline, and a LinkedIn post carousel (1 of 5). | — | `brand/12` |
| 12 | "Your selection" | Confirm the rate line (*Creator rate · Single post · 102 € · Standard rate*). "Book this option at the listed price, or propose a lower price." | *Negotiate* → offer form; *Book · 102 €* → NOT SEEN | `brand/13` |
| 13 | "Make an offer" | Discount preset (10% / 20% / 30% / Other), **Your offer** (€ number), **Post by** (date, defaults to 14 days, chip "14 days from now", "Latest date the creator must publish the post"), **How should the creator work?** → *Specific brief* ("Use detailed instructions from one of your campaign briefs"), checkbox "I want to approve the content before it is published." Notice: "Create a campaign brief first, then return to your saved creator selection." → *Create a brief →* | Blocked here without a brief. Submit button and the sentence "The creator receives the offer immediately and can accept or decline it within …" are cut off — NOT SEEN | `brand/14`, `brand/15` |
| 14 | Campaign launch method | "How do you want to launch your campaign? — Choose your method. You can change everything before launch." Three options: *Launch free with the Naano team* (a campaign manager builds it, → Book my onboarding), *Create with AI* (5 min, "AI asks the right questions and prepares a fully editable brief"), *Start from your link* (1 min, paste a campaign you already ran, "Naano reuses the brief and structure"). | All three lead into brief creation — the editor itself is NOT SEEN | `brand/29` |
| 15 | Dashboard (`/brand`) | "Here is what is happening for Atira on Naano." KPI tiles: Creators activated, Posts published, Profiles engaged, Impressions (all 0). *To do* list with badges. *Recently engaged companies / ICP accounts in your target*. Messages. New creators. *+ New campaign*. | To-do rows deep-link into the blocked/suggested action | `brand/24` |
| 16 | Launch plan checklist | Three guided actions: 1 *Discover the Marketplace* (Done), 2 *Create your first brief*, 3 *Book or negotiate with a creator*. Progress chip in the top bar ("Create your first br… 1/3"). Later variant adds "NEED A HAND? Build your first creator plan with Thomas → Book a call". | Each row is a shortcut into the corresponding flow | `brand/17`, `brand/38` |
| 17 | Collaborations | Search + status tabs. Table columns: Creator, Campaign, Status, Next action, Due date, Amount, Updated. Summary: 0 collaborations / €0 committed / 0 need action. | Empty: "No collaborations yet, invite a creator from the Marketplace." | `brand/28` |
| 18 | Leads & Analytics (Beta) | Tabs *Leads* / *Posts* / *Analytics*. *Top leads* ("Your warmest ICP accounts, sorted by fit"). *Companies in your ICP* — COMPANY, ICP, PEOPLE ENGAGED, ENGAGEMENT, TOP CONTACT, LAST SEEN, PRIORITY. *People who engaged* — PERSON, COMPANY, ROLE, ENGAGEMENT, WHEN, SOURCE, PRIORITY. *Export ICP leads*. | All empty. Posts and Analytics tabs: NOT SEEN | `brand/27`, `brand/31` |
| 19 | Messages | Search, filter *All messages* / *Campaign ▾*. Only thread is NaanoBot. Right pane: "Threads open with your bookings." | — | `brand/26` |
| 20 | Billing | "Available balance €0.00 — Ready to spend across your campaigns." *Add budget*, *+ €2,500*, *+ €10,000*. Invoices tabs All / Top-ups / Bookings; columns Reference, Date, Type, Amount, Status, Actions. | Top-up flow itself: NOT SEEN | `brand/16` |
| 21 | Settings — Workspace profile | Sub-nav: Workspace profile, Brand intelligence, Team & access, Integrations, Measurement. | — | `brand/23` |
| 22 | Settings — Brand intelligence | *Identity*: Company name, Website, Tagline. *Sector & size* [AUTO]: Your industry (chip + Change), Company size (1–10 / 11–50 / 51–200 / 201–1,0… / 1,000+). *Product story* [AUTO]: Description (+ features, differentiators — below the fold). "Filled by Naano from your website. Change only if something is wrong." | — | `brand/22` |
| 23 | Settings — Team & access | *Invite a colleague*: Work email → Send invitation. "They'll receive a secure link that expires after 14 days." *People with access* — 1 person, role badge **Owner**. "Members receive administrator access. Only you, the owner, can invite or remove people." | — | `brand/23` |
| 24 | Settings — Integrations | Connect **Claude** ("Use Naano from Claude and Cowork") and **ChatGPT** ("Use Naano from a custom ChatGPT app"), both status AVAILABLE. "The connection requires OAuth consent, and write actions remain subject to user approval." | OAuth screens: NOT SEEN | `brand/21` |
| 25 | Settings — Measurement | NOT SEEN (nav item only) | — | — |
| 26 | Account menu | Invite Creators / Book a call / Integrations / Settings / Sign out | *Book a call* → public marketing page "Your next creator campaign starts here", 30-minute campaign strategy call | `brand/19`, `brand/20` |
| 27 | Workspace switcher | Current space "Atira", field "New space name" + *Create*. | Multiple spaces per account | `brand/30` |

Dead ends, loops, or places the flow branches:

- **The offer form is a hard dependency loop.** "Make an offer" only exposes one
  work mode, *Specific brief*, and that mode requires a brief that does not
  exist yet — "Create a campaign brief first, then return to your saved creator
  selection" (`brand/15`). The launch-plan checklist orders the steps the other
  way round (discover → brief → book), so arriving from the Marketplace *Book*
  button lands in a blocked state.
- **Wallet gates the first booking.** The dashboard to-do "Top up your wallet"
  is badged **Blocked**, the other two are **Suggested** (`brand/24`).
- Three separate entry points converge on brief creation: the launch-plan
  checklist, the offer form's "Create a brief", and the campaign launch method
  screen (`brand/29`).
- "Go to my dashboard" at the end of onboarding (`brand/08`) was followed by the
  Marketplace "Matched" screen (`brand/09`), not `/brand`. Whether that is a
  redirect or a manual navigation: NOT SEEN.
- Two guided layers run at the same time: a 3-step *Marketplace tour* popover and
  a separate *Get started 0/3 → 1/3* launch-plan checklist in the top bar.

Where the flow ends (what "done" looks like for a brand):

- NOT SEEN. No brief was created, no offer sent, no booking funded, no post
  published. Every result surface (Collaborations, Leads & Analytics, Messages,
  Invoices, dashboard KPIs) was empty in this walkthrough.
- The stated destination, from the dashboard KPI row and Leads & Analytics, is:
  creators activated → posts published → profiles engaged → impressions →
  companies in your ICP → people who engaged → exported ICP leads.

---

## 2. Creator flow

Same treatment from the creator side.

| # | Screen / step | What it asks for | Where it leads | Screenshot |
|---|---------------|------------------|----------------|------------|
| 1 | Join Naano — step 1 of 4 | Sign up with LinkedIn / Google / email. "Get paid to create LinkedIn content for B2B brands you actually use." Right rail previews the empty marketplace card ("Build a card brands can trust. It updates live with your profile, analytics, positioning and price."). | → step 2 | `creator/01` |
| 2 | Step 2 of 4 — LinkedIn profile | One field: **public LinkedIn profile URL**. "No extension is needed." Consent line: "you authorize Naano to read your public profile once: name, photo, headline, country and follower count. We do not import your posts, engagement or private analytics." Button goes to "Reading your profile…". | Scrape → step 3 | `creator/02` |
| 3 | Step 3 of 4 — complete your card | **Country** (prefilled from LinkedIn, editable). **Industries, pick up to 3** — chips: B2B, B2C, AI, SaaS, Software, Sales, Marketing, SEO, Outreach, CRM, Creative, Productivity, Fintech, HealthTech, EdTech, Cybersecurity, Growth / GTM, HR, E-commerce, Developer Tools, Data / Analytics, Customer Support, Design, Real Estate / PropTech, LegalTech, InsurTech, Logistics / Supply Chain, Recruiting / Talent. | → step 4 | `creator/03` |
| 4 | Step 4 of 4 — price | **Net price per post** (stepper, pre-filled with a Naano recommendation). "Naano recommends this starting price from the public audience and performance information currently available." | *Create my marketplace profile* or *Add a bundle (optional)* | `creator/04` |
| 5 | Step 4 — bundle (optional) | **Number of posts** + **Total net price**. Derived line: per-post price and "brand saves €X". "+ Add another bundle". | *Confirm my offer and create my profile* | `creator/05` |
| 6 | Professional information (optional) | Complete now / Finish later. "Required later to apply to paid campaigns, accept bookings, invoice or withdraw earnings." Splits by geography: EU/France requires a registered professional activity; US/non-EU can continue as an individual. | Either way → card reveal | `creator/06` |
| 7 | Card reveal | "Tap it to flip it over." Back of card: About, **Performance & ICP** ("Public LinkedIn profile data from Apify (Basic card)") — Followers, Reactions per post, Typical impressions per post, Comments per post, Engagement rate — and **Who you target (est.)** — "Estimated from your public posts + bio (dominant themes)", INDUSTRY and LOCATION with percentages. | *Continue to my profile* | `creator/07`, `creator/08` |
| 8 | My card | "Your Naano card, ready to travel." Edit / Preview toggle. **Your card is your Deal Link** — "Put it on LinkedIn. Earn when a brand joins through it." Two suggestions: add it as a LinkedIn experience, send it when a brand contacts you. *Copy or share my Deal Link*. Your share 25%, reward period 3 months. Banner: "Complete your professional information before applying to paid campaigns, accepting bookings, invoicing or withdrawing your earnings." Tour 1/5. | — | `creator/09`, `creator/18` |
| 9 | Overview | "Your creator activity, at a glance." Tiles: Public post reach, Public posts, Public engagements, LinkedIn followers. *Your creator card* (Open card / Copy card link / Share my card). **Your launch guide** — "Card and price ready" ✓, "Visible on the Marketplace" ✓. Tour 2/5. | — | `creator/10`, `creator/17` |
| 10 | Opportunities | "Open brand campaigns - apply, the brand accepts, and the booking is created on your terms." Channel filter (All channels 35 / LinkedIn 35), search, All industries, All countries, sort *Relevance*. Campaign cards carry: match score (e.g. 100% / "Audience relevance 100/100"), country scope, eligible-followers threshold, channel, managed-by agency, post deadline. Tour 3/5. | *View the brief* → drawer; *Apply* → apply modal | `creator/11`, `creator/19` |
| 11 | Brief drawer | Read-only brief for one campaign, plus *Copy as Markdown* and **Create my post with AI** — "Copy a clean prompt with the brief, angles and examples. Paste it into your AI; add 2 or 3 previous posts if it does not know your style yet." → *Copy for my AI*. | — | `creator/20` |
| 12 | Apply modal (external campaign) | Consent. "This collaboration is not contracted, managed or paid through Naano." Shows campaign brand → managing agency. **Estimated pay per post**, banded by follower count (15,000–100,000 → €250–€1,000; over 100,000 → €1,000–€1,500). Checkbox: "I agree that my contact email, first name, last name, LinkedIn URL and follower count are shared with <agency> for this collaboration." | *Share my profile with <agency>* (disabled until checked). Naano-managed apply path: NOT SEEN | `creator/21` |
| 13 | Collaborations | "Every step tells you where you stand, what to do, and what happens if you do nothing." Tabs with counts. Columns: Brand, Campaign, Status, Performance, Next action, Due date, Your net. Tour 4/5. | Empty: "Brand invitations and your accepted applications land here." | `creator/12`, `creator/22` |
| 14 | Analytics | "See the business impact of your paid collaborations." Range select (All time). *Your creator momentum* — "Public LinkedIn posts are being imported". Tiles: Public posts, Public post reach, Public engagements, LinkedIn followers. *Top collaborations*. *Your opportunity journey — From applications to completed work*. Note: "No personal LinkedIn connection is required." Tour 5/5. | — | `creator/13`, `creator/14`, `creator/23` |
| 15 | Earnings | Tiles: Total earned, In transit ("International transfers usually arrive within 1–7 days"), Available now. *Earnings over time* (6-month bars). **Withdraw earnings** — payout method radio: Bank transfer (no account holder / no bank details on file) or Stripe (Not connected → *Connect Stripe*); amount + *Withdraw all* + *Confirm withdrawal*. *Recent activity* tabs: Earnings and withdrawals / Awaiting release / Invoices — columns Date, Type, Detail, Amount, Status, Invoice. | Bank details modal: Bank country, Account holder, *Save bank details* | `creator/15`, `creator/26`, `creator/27`, `creator/37` |
| 16 | Community | *Naano creators on Slack* (feedback before publishing, campaign tips, direct line to the Naano team) and *LinkedIn visibility* — "Turn your LinkedIn profile into an always-on Deal Link", 25% of Naano's commission for 3 months, with a suggested LinkedIn experience entry ("Naano Creator — Naano · Independent — Present"). **Naano campaign leaderboard** — "Estimated impressions generated by sponsored posts published for Naano brand collaborations", toggle Estimated impressions / Posts, top 10 named creators with per-creator impression totals. | — | `creator/24`, `creator/25` |
| 17 | Affiliate program — Invite brands | *Copy my referral link*. Two link types: **Recommend Naano** ("when a company wants to discover creators or start influencer marketing") and **Share your Creator Card** ("when a brand already wants to collaborate with you — your profile stays selected when it creates its account"). Both pay 25% of Naano's commission for three months. Live tracking table for introduced brands. | — | `creator/28`–`creator/30` |
| 18 | Affiliate program — Invite creators | Personal invite link (`naano.com/invite/creator/…`), your share 25%, earning window 3 months. "The window starts with their first completed paid collaboration — never at signup." Three steps: invite → they join and publish → earn when they do. Link is **locked**: "Publish your Creator Card to unlock your invite link." | — | `creator/31`, `creator/32` |
| 19 | Messages | Search conversations. Only thread is NaanoBot. "No conversations yet - the thread opens with your first Booking." | — | `creator/33` |
| 20 | Settings | **Company and billing** — Registration country, "Do you have a registered business?" Yes/No, Legal name, Legal address, plus consent checkboxes (sole responsibility for declaring and paying taxes; authorizing Naano to self-bill invoices in the creator's name; certifying legal right to provide paid services). **Personal profile** — display name. **Social links** — LinkedIn URL + *Re-sync* ("Last scrape: … · limited to once a week"), synced followers and country, editable industries (up to 3); X field is declarative ("X stats arrive with the integration"). **Bank details**. **Guided tour** — *Restart the tour*. **Delete your account** — irreversible. | — | `creator/34`–`creator/36` |

Where the two sides touch (handoffs between brand and creator):

- **Marketplace ↔ Creator card.** Everything the brand filters and sorts on
  (industry, country, price, CPM, median views, followers, engagement, posted
  recently) is set on the creator side in steps 3–5 and in creator Settings.
- **Offer → Collaboration.** The brand sends an offer with a price, a *post by*
  date, a brief and an optional approval requirement (`brand/14`); the creator's
  Collaborations tab set includes *Applications sent* and the brand's includes
  *Invitation sent*, so both directions exist. The creator-side copy says
  "apply, the brand accepts, and the booking is created on your terms".
- **Booking → Messages.** Both sides say the thread only opens with a booking
  ("Threads open with your bookings" / "the thread opens with your first
  Booking").
- **Published post → Leads.** The brand's Leads & Analytics is fed by post
  engagement ("No leads yet, they appear when your posts drive engagement");
  the creator's Analytics is fed by the same public-post import.
- **Deal Link / affiliate.** A creator's card doubles as a referral link that
  attributes a brand signup to that creator for 3 months at 25% of Naano's
  commission.
- **External campaigns bypass the platform entirely.** `creator/21`: contracting,
  communication and payment happen outside Naano, with an agency in between.

Where "done" is for a creator:

- NOT SEEN end-to-end. In this walkthrough the account reached "Visible on the
  Marketplace" (launch guide complete, card published) but no application, no
  booking, no post, no earnings.
- The stated destination is a completed paid collaboration: earnings move
  Total earned → In transit → Available now → withdrawn via bank transfer or
  Stripe, with a self-billed invoice.

---

## 3. Objects I can see

The nouns the product exposes — inferred from the UI, URLs, and any payloads
visible in the network tab. One per object.

_No network tab was captured — everything below is read off the UI and URLs._

### Workspace (brand "space")

- Where it appears: switcher in the brand sidebar; Settings → Workspace profile.
- Fields visible in the UI: name ("Atira"). Creation takes a single field, "New
  space name".
- Who creates it / who can edit it: created at signup, and any user can create
  more from the switcher.
- Lifecycle or states: NOT SEEN.
- Relates to: Brand profile, Members, Campaigns, Wallet, Collaborations.
- Evidence: `brand/30`, `brand/26`.

### Brand profile / brand intelligence

- Where it appears: onboarding step 2; Settings → Brand intelligence.
- Fields visible in the UI: company name, website, tagline, industry (single
  chip), company size (5 buckets), product story description (+ features and
  differentiators, below the fold), value proposition.
- Who creates it: generated by Naano from the website scrape, marked **AUTO**,
  brand-editable. "Change only if something is wrong."
- Lifecycle or states: NOT SEEN. Only the AUTO badge distinguishes generated
  values from edited ones.
- Relates to: ICP, matching, AI briefs ("used for AI briefs and how creators
  understand your brand").
- Evidence: `brand/05`, `brand/22`.

### ICP

- Where it appears: onboarding step 2; Leads & Analytics ("ICP" column,
  "Companies in your ICP", "ICP accounts in your target").
- Fields visible in the UI: rank (1–3), role title, description paragraph
  (role, company type, pain, product fit), theme chips.
- Who creates it: generated from the site scrape, brand-editable at onboarding.
  Whether it stays editable afterwards: NOT SEEN.
- Lifecycle or states: NOT SEEN.
- Relates to: creator matching ("Comparing creator evidence with your ICP"),
  leads, engaged companies.
- Evidence: `brand/06`–`brand/08`, `brand/27`.

### Creator card / marketplace profile

- Where it appears: creator signup steps 2–4, My card, the brand Marketplace
  grid, and the creator profile drawer.
- Fields visible in the UI: name, avatar, LinkedIn headline, country, up to 3
  industries, followers, estimated impressions / median views, CPM, price per
  post ("Chosen cost"), engagement rate, reactions per post, comments per post,
  About, "Who you target (est.)" (industry % and location %), bundle chip,
  post-count chips ("0 posts · 7d", "0 posts · 90d").
- Who creates it / who can edit it: the creator. Public LinkedIn data is scraped
  (attributed to **Apify**, "Basic card"), not creator-entered.
- Lifecycle or states seen: *Pending* / "Reading your profile…" for the scraped
  data; "Visible on the Marketplace" once published; the affiliate invite link
  stays locked until the card is published.
- Relates to: Bundle, Deal Link, Opportunities, Bookings.
- Evidence: `creator/01`–`creator/09`, `brand/09`–`brand/12`.

### Bundle

- Where it appears: creator signup step 4; card chip; Settings ("You can add
  bundles later in Settings").
- Fields visible in the UI: number of posts, total net price. Derived: price per
  post and "brand saves €X". Multiple bundles allowed ("+ Add another bundle"),
  first one labelled **Primary bundle**.
- Who creates it: the creator.
- Lifecycle or states: NOT SEEN.
- Relates to: Creator card, Offer (the brand's selection modal showed only
  "Single post" for this creator).
- Evidence: `creator/05`.

### Campaign

- Where it appears: brand sidebar (*+ Create campaign*, *All campaigns*),
  Collaborations table column, Messages filter, creator Opportunities.
- Fields visible in the UI (from the creator side): campaign name, brand,
  country scope, channel (LinkedIn), match / audience-relevance score, eligible
  followers threshold, managed-by (agency), post deadline, "Featured
  collaboration" flag.
- Who creates it: the brand, via one of three routes — Naano team, AI, or an
  imported link.
- Lifecycle or states: NOT SEEN (no campaign was created).
- Relates to: Brief, Collaboration, Creator applications.
- Evidence: `brand/29`, `creator/11`, `creator/19`.

### Brief

- Where it appears: the offer form's required "Specific brief", the launch-plan
  checklist, and the creator-side brief drawer.
- Fields visible in the UI: context paragraph; the drawer also offers *Copy as
  Markdown* and an AI prompt export. The editor itself: **NOT SEEN**.
- Who creates it: the brand.
- Lifecycle or states: NOT SEEN.
- Relates to: Campaign, Offer, Collaboration.
- Evidence: `brand/15`, `creator/20`.

### Offer / Booking

- Where it appears: creator profile right rail, "Your selection", "Make an
  offer".
- Fields visible in the UI: rate option (Single post + price, labelled
  "Standard rate"), offered price / discount %, *Post by* date (default +14
  days), work mode (*Specific brief*), "approve content before publication"
  flag.
- Who creates it: the brand. "Secure booking · Creator approves first"; "The
  creator receives the offer immediately and can accept or decline it within …"
  (window length cut off — NOT SEEN).
- Lifecycle or states seen: *Invitation sent* (brand tab), *Applications sent*
  (creator tab), *Declined*, *Active*, *Completed*.
- Relates to: Collaboration, Message thread, Wallet, Earnings.
- Evidence: `brand/13`, `brand/14`, `brand/15`.

### Collaboration

- Where it appears: both sides have a Collaborations page.
- Fields visible in the UI — brand: Creator, Campaign, Status, Next action, Due
  date, Amount, Updated. Creator: Brand, Campaign, Status, Performance, Next
  action, Due date, Your net.
- Who creates it: created from an accepted offer or an accepted application.
- Lifecycle or states seen (tab labels, both sides):
  - Brand: **All · Active · Needs action · Invitation sent · Declined · Completed**
  - Creator: **All · Active · Needs action · Applications sent · Declined · Completed**
  - Aggregates: "committed" (€) and "need action" (count).
  - The transitions between these states were never observed — NOT SEEN.
- Relates to: Campaign, Brief, Offer, Messages, Earnings, Invoice.
- Evidence: `brand/28`, `creator/12`, `creator/22`.

### Lead — engaged person, and engaged company

- Where it appears: brand Leads & Analytics; dashboard "Recently engaged
  companies".
- Fields visible in the UI — company: Company, ICP, People engaged, Engagement,
  Top contact, Last seen, Priority. Person: Person, Company, Role, Engagement,
  When, Source, Priority.
- Who creates it: derived from engagement on published creator posts ("they
  appear when your posts drive engagement"). "Each lead is linked to their
  company. The button opens their LinkedIn profile."
- Lifecycle or states: a **Priority** field exists on both; its values were
  never populated — NOT SEEN.
- Relates to: Post, Campaign, ICP. Exportable via *Export ICP leads*.
- Evidence: `brand/27`, `brand/31`, `brand/24`.

### Post

- Where it appears: creator profile Content tab, creator Analytics, Leads &
  Analytics *Posts* tab (not opened).
- Fields visible in the UI: author, date, "Public LinkedIn post", body, views,
  reactions, comments, reposts, *Open original ↗*. Derived: latest post,
  estimated cadence, posts analyzed, reach sparkline.
- Who creates it: scraped from public LinkedIn for marketplace evidence;
  sponsored posts are published by the creator against a collaboration.
- Lifecycle or states: creator-side import shows "Public LinkedIn posts are
  being imported" / "Public post import in progress". Sponsored-post states
  (draft, approval, published): **NOT SEEN** — the creator Collaborations copy
  mentions "briefs, drafts and publication steps".
- Relates to: Creator, Collaboration, Lead, Impressions.
- Evidence: `brand/12`, `creator/13`, `creator/14`.

### Wallet / budget and invoices (brand)

- Where it appears: top-bar chip (€0.00) and Billing.
- Fields visible in the UI: available balance; top-up presets €2,500 / €10,000;
  invoice rows Reference, Date, Type, Amount, Status, Actions; invoice tabs All
  / Top-ups / Bookings.
- Lifecycle or states: an invoice **Status** column exists; values NOT SEEN.
- Relates to: Booking (a booking is "funded" — "send your first funded
  invitation").
- Evidence: `brand/16`.

### Earnings / payout (creator)

- Where it appears: creator Earnings.
- Fields visible in the UI: Total earned, In transit, Available now, monthly
  earnings bars, payout method (Bank transfer / Stripe), withdrawal amount.
  Recent activity: Date, Type, Detail, Amount, Status, Invoice.
- Lifecycle or states seen: **Total earned → In transit → Available now**, plus
  an *Awaiting release* tab and, for Stripe, *Not connected*.
- Relates to: Collaboration, Invoice, Bank details.
- Evidence: `creator/15`, `creator/27`, `creator/37`.

### Affiliate / referral attribution

- Where it appears: creator Affiliate program (two tabs), My card Deal Link,
  brand account menu *Invite Creators*.
- Fields visible in the UI: share 25%, reward period / earning window 3 months,
  referral link, creator invite link, total earned, live tracking tables for
  introduced brands and invited creators.
- Lifecycle or states: for creator referrals the window "starts with their first
  completed paid collaboration — never at signup". For brand referrals: NOT SEEN
  when the window starts.
- Relates to: Creator card, Workspace signup.
- Evidence: `creator/28`–`creator/32`, `creator/09`.

### Member / access (brand)

- Where it appears: Settings → Team & access.
- Fields visible in the UI: initials, name, email, role badge.
- Roles seen: **Owner**. "Members receive administrator access. Only you, the
  owner, can invite or remove people." So two levels: Owner and administrator.
- Lifecycle or states: invitations expire after 14 days; "Active members and
  invitations awaiting acceptance" implies a pending state, none observed.
- Evidence: `brand/23`.

### Message thread

- Where it appears: both sides.
- Fields visible in the UI: participant, last message, timestamp, unread badge.
  Brand-side filter by campaign.
- Lifecycle: opens with a booking. Only the NaanoBot thread existed.
- Evidence: `brand/26`, `creator/33`.

Relationships between the objects, once there are more than two:

```
Workspace ──< Member
    │
    ├── Brand profile ──< ICP ─────────────┐
    │                                      │ (matching)
    ├── Wallet ──< Invoice                 │
    │                                      ▼
    └──< Campaign ──< Brief          Creator card ──< Bundle
                │                          │             │
                └────────► Offer ◄─────────┘             │
                             │  (price / bundle option)  │
                             ▼                           │
                       Collaboration ───────────────────┘
                             │
              ┌──────────────┼───────────────┐
              ▼              ▼               ▼
        Message thread     Post          Earnings ──< Payout
                             │
                             ▼
                     Lead (person) ──> Engaged company ──> ICP match
```

The load-bearing chain for the pitch is the right-hand column:
**Campaign → Collaboration → Post → Lead → Company → ICP**. That is the only
path that ties pipeline back to a specific post, and it is the one part of the
product that could not be observed with data in it.

---

## 4. What is good

> **DRAFT — my read only, to be rewritten by hand.**

Things that work and are worth keeping. For each: what it is, and why it works
— not just praise.

- **Both onboardings ask for one thing at a time and derive the rest.** The
  brand types a URL and gets a value prop and three ICPs back to confirm; the
  creator pastes a LinkedIn URL and gets a card. Neither side is asked to write
  a profile from scratch, and both are shown the generated result as editable
  text rather than a fait accompli.
- **Audience composition is the right unit, and it is sourced.** The creator
  profile leads with "37% in observed audience · Marketing" and breaks the
  audience down by job title, seniority, industry and geography, each labelled
  "Estimated from 49 recent public engagers" with the observed-profile count
  visible. Follower count is present but demoted to one cell among five. This is
  the audience-fit argument made concrete, and the sample size is disclosed
  rather than hidden.
- **Evidence sits next to the price.** Typical reach, estimated CPM and posts
  analyzed are in the same right rail as the rate and the book button, so the
  price is read against the reach that justifies it.
- **Performance filters state what they do to the ranking.** "These filters hide
  creators; matching scores stay unchanged" and "Creators with unavailable
  performance data remain visible" — two sentences that prevent the usual
  filter-vs-rank confusion and stop thin-data creators from silently vanishing.
- **The lead tables are modelled the way B2B actually buys.** Person → company →
  ICP → priority, with the company table and the person table linked, and an
  export. This is the attribution claim expressed as a schema, not a chart.
- **Creator-side money copy is unusually plain.** Net price throughout, "brand
  saves €X" computed on the bundle, the tax and self-billing consents written
  out, EU vs non-EU obligations separated, and the affiliate window explicitly
  starting at first completed collaboration "never at signup".
- **Both sides read the same collaboration.** Near-mirrored status tabs and a
  "Next action / what happens if you do nothing" framing means one shared state
  machine rather than two divergent inboxes.

---

## 5. What is weak

> **DRAFT — my read only, to be rewritten by hand.**

Things that exist but are doing a bad job. For each: what it is, what goes
wrong, and how much it costs the user.

- **The primary CTA leads into a dead end.** *Book* → *Collaborate* → *Your
  selection* → *Make an offer* → the only work mode is "Specific brief" → "Create
  a campaign brief first, then return to your saved creator selection." The
  fastest path through the marketplace ends in a modal that cannot be submitted.
  Cost: the highest-intent moment in the product is spent on a detour.
- **Three onboarding systems run at once.** A Marketplace tour (1/3), a Get
  started checklist (0/3 → 1/3), and interruption toasts ("AI improved your
  matches", "Campaigns organise your creator work"). On `brand/15` a tour
  popover overlaps the offer form it is describing and truncates its own text.
  Cost: the guidance competes with the task and with itself.
- **Audience geography undercuts the fit story for the featured creator.**
  `brand/11`: India 43%, Pakistan 24%, Nigeria 8% for a creator surfaced against
  a European industrial-manufacturing ICP, priced at €1 CPM. The audience panel
  is doing its job — the ranking above it is not reading the panel.
- **Two industry vocabularies.** The creator picks from ~28 industries
  (`creator/03`); the brand filters on a much shorter list (AI, Data, Marketing,
  SEO, Content, Sales…) (`brand/36`). Cost: a creator's third industry may not
  be reachable by any brand filter.
- **"Go to my dashboard" does not go to the dashboard.** It lands on the
  Marketplace. Small, but it is the first promise the product makes after
  onboarding.
- **Sample sizes are thin and stated in the same weight as the conclusion.**
  "Posts analyzed 5", "49 recent public engagers", "Typical range: Not
  available" sit beside a confident "100/100 match" on the opportunity cards.
  Precision is being implied that five posts cannot support.
- **The wallet blocks before it explains.** "Top up your wallet" is badged
  *Blocked* on an account with no campaign, no brief and no creator selected —
  a red flag against a step the user has no reason to take yet.
- **Externally-managed campaigns are the most prominent opportunities.** The
  featured card is an agency-run collaboration that is "not contracted, managed
  or paid through Naano", where the creator's contact details leave the platform
  and pay is banded on follower count — the exact metric the product argues
  against. Every downstream promise (attribution, leads, earnings) is void for
  those.
- **Match scores are unexplained.** "100% match", "Audience relevance 100/100",
  "Best match" sort — no expander, no inputs, and several 100/100s at once.
  "How pricing is calculated" exists on the profile; the equivalent for matching
  does not.

---

## 6. What is missing

> **DRAFT — my read only, to be rewritten by hand.**

Things that are absent. For each: what is missing, who notices, and what they
do instead today.

- **The attribution chain itself, in a state where it holds data.** Leads &
  Analytics, the dashboard KPIs, Top collaborations and the ICP tables were all
  empty. The pitch — pipeline traced back to each post — is the one thing this
  walkthrough could not see working. Noticed by: anyone evaluating the product
  before signing. Today: they take it on trust or book the call.
- **No UTM, CRM or destination anywhere.** For posts to produce *pipeline* there
  has to be a link, a form or a CRM object at the end. Settings has a
  *Measurement* tab (never opened — NOT SEEN) and Integrations offers Claude and
  ChatGPT but no HubSpot, Salesforce or webhook. Noticed by: the B2B marketer
  who has to report this alongside every other channel. Today: they export ICP
  leads to CSV and reconcile by hand.
- **No sample or demo state.** Every surface was an empty state. Nothing shows a
  brand what a good week looks like. Noticed by: every new account.
- **No per-post or per-creator attribution view.** Leads have a *Source* column,
  but there is no screen that starts from one post and shows what it produced —
  the exact view the pitch describes. Noticed by: whoever has to justify the
  spend. Today: NOT SEEN.
- **No spend or pacing view on the brand side.** A wallet balance and invoices,
  but no committed-vs-spent, no cost per lead, no cost per engaged ICP account.
  Noticed by: whoever owns the budget.
- **No approval or draft surface was visible.** The offer form has "I want to
  approve the content before it is published" and the creator copy mentions
  "briefs, drafts and publication steps", but neither side showed where a draft
  is reviewed. Noticed by: both sides, on the first booking.
- **Nothing explains matching to the person being matched.** A creator sees
  "100% match" with no statement of what was compared, and cannot tell why they
  do or do not appear for a brand. Noticed by: creators deciding whether to
  invest in the card.
- **No shared team state on the brand side.** Everyone above the owner is an
  administrator; no reviewer or read-only role, no shared shortlist, no notes on
  a creator. *Saved 0* exists but is a personal list. Noticed by: any team of
  more than one.
- **No creator-side rejection or negotiation UI was visible.** The brand can
  propose a discount; whether the creator can counter — as opposed to accept or
  decline — is NOT SEEN.

---

## Open questions

Things I could not settle from the outside and would need to ask about or dig
into further.

- What actually populates Leads & Analytics? Which engagement signals are
  captured from a sponsored post, how a person is resolved to a company, and how
  a company is matched to an ICP.
- What does the *Source* column on a lead contain — post, campaign, or creator?
- What is in Settings → **Measurement**? It is the only plausible home for
  tracking links or CRM, and it was never opened.
- What is the match score computed from, and why did several unrelated campaigns
  all score 100/100?
- Why is the brand's industry filter list shorter than the creator's industry
  vocabulary — deliberate, or drift?
- How long does a creator have to accept or decline an offer? The sentence is
  truncated on `brand/15`.
- Can a creator counter-offer, or only accept/decline?
- Are bundles bookable? The selection modal showed only "Single post" for a
  creator who had not set one — behaviour with a bundle is unknown.
- What happens between *Invitation sent* and *Active* — is there a draft and
  approval step, and where does it live?
- What is the difference between "Est. impressions", "Typical impressions per
  post", "Median views" and "Typical reach"? Four labels appear across the card
  and profile; whether they are the same number is unclear.
- Where does an externally-managed campaign's outcome land? If contracting and
  payment happen off-platform, do those posts still feed Leads & Analytics?
- Is the ICP set editable after onboarding, and does re-running the site scrape
  overwrite manual edits?
- Does re-syncing LinkedIn (limited to once a week) recompute the recommended
  price, and does it touch a price the creator has already changed?
- What are the invoice **Status** values, and the collaboration statuses between
  the tab labels?
- The verification-code screen (brand step 4) was never captured — what does it
  ask for and what are its failure paths?
