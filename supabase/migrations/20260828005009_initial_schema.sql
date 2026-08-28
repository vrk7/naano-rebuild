-- Initial schema for naano-rebuild.
--
-- Mirrors the data model in docs/PRODUCT.md. Row level security is
-- deliberately NOT enabled here; policies land in a later migration together
-- with the access-control tests CLAUDE.md requires.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Two roles only (PRODUCT.md, "Tenancy and access").
create type member_role as enum ('owner', 'admin');

create type topic_kind as enum ('industry', 'function');

create type profile_source as enum ('auto', 'edited');

-- Shared by icp_target and audience_facet. The score computes overlap by
-- joining these two on (dimension, value), so they must draw on one type.
create type facet_dimension as enum ('job_function', 'seniority', 'industry', 'geo');

create type snapshot_source as enum ('seed', 'scrape');

-- Bundles are cut (SCOPE.md); the enum exists so they return without a
-- migration.
create type rate_kind as enum ('single');

create type campaign_status as enum ('draft', 'live', 'closed');

create type brief_mode as enum ('specific', 'creative_freedom');

create type collaboration_state as enum (
  'invited',
  'accepted',
  'drafting',
  'in_review',
  'changes_requested',
  'approved',
  'published',
  'completed',
  'declined',
  'expired',
  'cancelled'
);

create type event_actor as enum ('brand', 'creator', 'system');

create type check_kind as enum ('deterministic', 'model');

create type check_status as enum ('pass', 'fail', 'warn');

create type engagement_kind as enum ('reaction', 'comment', 'repost');

create type ledger_kind as enum ('topup', 'commit', 'release', 'refund');

-- ---------------------------------------------------------------------------
-- One taxonomy
-- ---------------------------------------------------------------------------

-- Single vocabulary shared by creator_topic, icp_target, brand_profile and the
-- marketplace filters, so a creator's topic is never unreachable by a filter.
create table topic (
  id    uuid primary key default gen_random_uuid(),
  slug  text not null unique,
  label text not null,
  kind  topic_kind not null
);

create index topic_kind_idx on topic (kind);

-- ---------------------------------------------------------------------------
-- Tenancy and access
-- ---------------------------------------------------------------------------

create table workspace (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  website    text,
  created_at timestamptz not null default now()
);

create table workspace_member (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         member_role not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- Every future RLS policy keys off "is this user a member of this workspace",
-- which is a lookup by user_id.
create index workspace_member_user_idx on workspace_member (user_id);

-- ---------------------------------------------------------------------------
-- Brand side
-- ---------------------------------------------------------------------------

create table brand_profile (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspace (id) on delete cascade,
  company_name text not null,
  website      text,
  tagline      text,
  value_prop   text,
  industry_id  uuid references topic (id) on delete set null,
  size_band    text,
  source       profile_source not null default 'auto',
  generated_at timestamptz
);

create index brand_profile_industry_idx on brand_profile (industry_id);

create table icp (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace (id) on delete cascade,
  rank         int not null check (rank between 1 and 3),
  label        text not null,
  description  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (workspace_id, rank)
);

-- Scoring and the leads view both read "the active ICPs for this workspace".
create index icp_workspace_active_idx on icp (workspace_id) where is_active;

create table icp_target (
  id        uuid primary key default gen_random_uuid(),
  icp_id    uuid not null references icp (id) on delete cascade,
  dimension facet_dimension not null,
  -- topic_id for industry, ISO-3166 for geo, enum value for the rest.
  value     text not null,
  weight    numeric(4, 3) not null default 1.0 check (weight >= 0 and weight <= 1),
  unique (icp_id, dimension, value)
);

-- score() loads every target for an ICP and groups them by dimension.
create index icp_target_icp_dimension_idx on icp_target (icp_id, dimension);

-- ---------------------------------------------------------------------------
-- Creator side
-- ---------------------------------------------------------------------------

create table creator (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null,
  headline     text,
  avatar_url   text,
  country      text,
  linkedin_url text unique,
  followers    int not null default 0,
  created_at   timestamptz not null default now()
);

-- Marketplace filters by country and sorts by followers.
create index creator_country_idx on creator (country);
create index creator_followers_idx on creator (followers desc);

create table creator_topic (
  creator_id uuid not null references creator (id) on delete cascade,
  topic_id   uuid not null references topic (id) on delete cascade,
  primary key (creator_id, topic_id)
);

-- Marketplace filters creators by topic, so the reverse lookup needs its own
-- index; the primary key only serves creator_id-first lookups.
create index creator_topic_topic_idx on creator_topic (topic_id);

-- PRODUCT.md caps creator_topic at 3 per creator. A CHECK cannot count rows,
-- so this is a trigger.
create function enforce_creator_topic_limit() returns trigger as $$
begin
  if (select count(*) from creator_topic where creator_id = new.creator_id) > 3 then
    raise exception 'creator % may have at most 3 topics', new.creator_id;
  end if;
  return null;
end;
$$ language plpgsql;

create constraint trigger creator_topic_max_3
  after insert or update on creator_topic
  deferrable initially deferred
  for each row execute function enforce_creator_topic_limit();

create table creator_rate (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references creator (id) on delete cascade,
  kind        rate_kind not null default 'single',
  price_cents int not null check (price_cents >= 0),
  currency    text not null default 'USD',
  unique (creator_id, kind)
);

create table audience_snapshot (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references creator (id) on delete cascade,
  captured_at    timestamptz not null default now(),
  -- Both gate whether a score is shown at all (PRODUCT.md, "Confidence").
  sample_size    int not null check (sample_size >= 0),
  posts_analyzed int not null check (posts_analyzed >= 0),
  source         snapshot_source not null
);

-- Scoring always reads the most recent snapshot for a creator.
create index audience_snapshot_creator_captured_idx
  on audience_snapshot (creator_id, captured_at desc);

create table audience_facet (
  id          uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references audience_snapshot (id) on delete cascade,
  dimension   facet_dimension not null,
  value       text not null,
  -- Rows sum to 1.0 within each dimension; that sum is not enforced here
  -- because it is only true once a whole dimension has been written.
  share       numeric(5, 4) not null check (share >= 0 and share <= 1),
  unique (snapshot_id, dimension, value)
);

-- overlap(d) sums share where (dimension, value) is in the ICP target set.
create index audience_facet_snapshot_dimension_idx
  on audience_facet (snapshot_id, dimension);
create index audience_facet_dimension_value_idx
  on audience_facet (dimension, value);

-- ---------------------------------------------------------------------------
-- Campaign and brief
-- ---------------------------------------------------------------------------

create table campaign (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace (id) on delete cascade,
  name         text not null,
  objective    text,
  status       campaign_status not null default 'draft',
  geos         text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create index campaign_workspace_status_idx on campaign (workspace_id, status);

create table brief (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null unique references campaign (id) on delete cascade,
  mode         brief_mode not null,
  body         text,
  -- Structured half, read by the deterministic draft checks. creative_freedom
  -- means {} and every check passes vacuously.
  requirements jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Collaboration
-- ---------------------------------------------------------------------------

create table collaboration (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references campaign (id) on delete cascade,
  creator_id        uuid not null references creator (id) on delete restrict,
  workspace_id      uuid not null references workspace (id) on delete cascade,
  state             collaboration_state not null default 'invited',
  price_cents       int not null check (price_cents >= 0),
  post_by           date,
  respond_by        timestamptz,
  approval_required boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- needs_action() and both sides' tab counts filter on workspace + state.
create index collaboration_workspace_state_idx on collaboration (workspace_id, state);
create index collaboration_campaign_idx on collaboration (campaign_id);
create index collaboration_creator_idx on collaboration (creator_id);
-- The system sweep for invited -> expired scans by deadline.
create index collaboration_respond_by_idx on collaboration (respond_by)
  where state = 'invited';

-- Append-only. No update or delete is expected; the log is the history.
create table collaboration_event (
  id               uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaboration (id) on delete cascade,
  from_state       collaboration_state,
  to_state         collaboration_state not null,
  actor            event_actor not null,
  actor_user_id    uuid references auth.users (id) on delete set null,
  note             text,
  at               timestamptz not null default now()
);

create index collaboration_event_collaboration_at_idx
  on collaboration_event (collaboration_id, at desc);

create table draft (
  id               uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaboration (id) on delete cascade,
  version          int not null check (version >= 1),
  body             text not null,
  submitted_at     timestamptz not null default now(),
  submitted_by     uuid references auth.users (id) on delete set null,
  unique (collaboration_id, version)
);

create table draft_check (
  id          uuid primary key default gen_random_uuid(),
  draft_id    uuid not null references draft (id) on delete cascade,
  rule_key    text not null,
  rule_label  text not null,
  kind        check_kind not null,
  status      check_status not null,
  -- A check that cannot point at the span it judged does not get to fail the
  -- draft (PRODUCT.md).
  evidence    text,
  explanation text,
  constraint draft_check_fail_needs_evidence
    check (status <> 'fail' or evidence is not null)
);

create index draft_check_draft_idx on draft_check (draft_id);

-- ---------------------------------------------------------------------------
-- Published posts
-- ---------------------------------------------------------------------------

-- Declared after collaboration because of the nullable back-reference.
create table creator_post (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references creator (id) on delete cascade,
  external_url     text not null unique,
  published_at     timestamptz,
  body             text,
  impressions      int not null default 0,
  reactions        int not null default 0,
  comments         int not null default 0,
  reposts          int not null default 0,
  is_sponsored     boolean not null default false,
  collaboration_id uuid references collaboration (id) on delete set null
);

create index creator_post_creator_published_idx
  on creator_post (creator_id, published_at desc);
create index creator_post_collaboration_idx on creator_post (collaboration_id);

create table post (
  id               uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null unique references collaboration (id) on delete cascade,
  creator_post_id  uuid not null references creator_post (id) on delete restrict,
  tracked_url      text,
  published_at     timestamptz not null default now()
);

create index post_creator_post_idx on post (creator_post_id);

-- ---------------------------------------------------------------------------
-- Attribution
-- ---------------------------------------------------------------------------

create table company (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text unique,
  industry_id uuid references topic (id) on delete set null,
  size_band   text,
  country     text
);

-- The post page rolls companies up by industry and country.
create index company_industry_idx on company (industry_id);
create index company_country_idx on company (country);

create table person (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  headline     text,
  role_title   text,
  seniority    text,
  linkedin_url text unique,
  company_id   uuid references company (id) on delete set null
);

create index person_company_idx on person (company_id);

create table engagement (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references post (id) on delete cascade,
  person_id   uuid not null references person (id) on delete cascade,
  kind        engagement_kind not null,
  occurred_at timestamptz not null default now(),
  unique (post_id, person_id, kind)
);

-- The post page lists engagements for one post; the leads table aggregates
-- them per person across posts.
create index engagement_post_idx on engagement (post_id);
create index engagement_person_idx on engagement (person_id);

create table icp_match (
  id        uuid primary key default gen_random_uuid(),
  person_id uuid not null references person (id) on delete cascade,
  icp_id    uuid not null references icp (id) on delete cascade,
  score     int not null check (score between 0 and 100),
  reasons   jsonb not null default '{}'::jsonb,
  unique (person_id, icp_id)
);

-- Leads sort by score descending within an ICP.
create index icp_match_icp_score_idx on icp_match (icp_id, score desc);
create index icp_match_person_idx on icp_match (person_id);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

create table wallet (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null unique references workspace (id) on delete cascade,
  balance_cents bigint not null default 0
);

create table ledger_entry (
  id               uuid primary key default gen_random_uuid(),
  wallet_id        uuid not null references wallet (id) on delete cascade,
  kind             ledger_kind not null,
  -- Signed: commit is negative, topup and release positive. No money moves.
  amount_cents     bigint not null,
  collaboration_id uuid references collaboration (id) on delete set null,
  at               timestamptz not null default now()
);

create index ledger_entry_wallet_at_idx on ledger_entry (wallet_id, at desc);
create index ledger_entry_collaboration_idx on ledger_entry (collaboration_id);
