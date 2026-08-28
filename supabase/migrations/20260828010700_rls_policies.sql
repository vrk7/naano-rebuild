-- Row level security.
--
-- Two crossings this file exists to prevent, both stated as tests in
-- CLAUDE.md's list ("Access control"):
--
--   1. A workspace cannot read another workspace's campaigns, posts or leads.
--      Campaigns are scoped directly. Posts and leads are scoped transitively:
--      a post belongs to a collaboration, which belongs to a workspace, and a
--      lead is only reachable through an engagement on such a post. person and
--      company are global tables with no workspace_id, so their policies walk
--      that chain rather than comparing a column.
--
--   2. A creator only sees collaborations they are on. Creator-side access
--      never goes through workspace membership; it resolves auth.uid() to a
--      creator row and compares collaboration.creator_id.
--
-- Everything is deny-by-default: RLS is enabled on all 25 tables and access
-- exists only where a policy grants it. Tables with no write policy are
-- readable-but-not-writable by design, not by omission — the seed writes them
-- with the service role, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------

-- security definer, because workspace_member has RLS of its own and a policy
-- that queried it directly would recurse into itself. set search_path = ''
-- forces fully-qualified names so the function cannot be captured by a
-- caller-controlled search path.
create function auth_workspace_ids()
  returns setof uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select workspace_id
  from public.workspace_member
  where user_id = (select auth.uid())
$$;

comment on function auth_workspace_ids is
  'Workspaces the current session belongs to. Empty for a creator-only login.';

-- Returns null when the session is not a creator, and null never equals a
-- creator_id, so every creator-side policy fails closed for brand users.
create function auth_creator_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select id
  from public.creator
  where user_id = (select auth.uid())
$$;

comment on function auth_creator_id is
  'Creator backing the current session, or null if the session is not a creator.';

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table workspace            enable row level security;
alter table workspace_member     enable row level security;
alter table topic                enable row level security;
alter table brand_profile        enable row level security;
alter table icp                  enable row level security;
alter table icp_target           enable row level security;
alter table creator              enable row level security;
alter table creator_topic        enable row level security;
alter table creator_rate         enable row level security;
alter table audience_snapshot    enable row level security;
alter table audience_facet       enable row level security;
alter table campaign             enable row level security;
alter table brief                enable row level security;
alter table collaboration        enable row level security;
alter table collaboration_event  enable row level security;
alter table draft                enable row level security;
alter table draft_check          enable row level security;
alter table creator_post         enable row level security;
alter table post                 enable row level security;
alter table company              enable row level security;
alter table person               enable row level security;
alter table engagement           enable row level security;
alter table icp_match            enable row level security;
alter table wallet               enable row level security;
alter table ledger_entry         enable row level security;

-- ---------------------------------------------------------------------------
-- Marketplace listings — readable by any signed-in user, written by no one
-- ---------------------------------------------------------------------------
--
-- These are the seeded population. They carry no workspace and no personal
-- data, so they are deliberately not workspace-scoped: a brand has to be able
-- to browse creators it has never worked with, which is what a marketplace is.
-- No insert, update or delete policy exists, so the seed's service-role key is
-- the only writer.

create policy "topic readable when signed in"
  on topic for select to authenticated using (true);

create policy "creator readable when signed in"
  on creator for select to authenticated using (true);

create policy "creator_topic readable when signed in"
  on creator_topic for select to authenticated using (true);

create policy "creator_rate readable when signed in"
  on creator_rate for select to authenticated using (true);

create policy "audience_snapshot readable when signed in"
  on audience_snapshot for select to authenticated using (true);

create policy "audience_facet readable when signed in"
  on audience_facet for select to authenticated using (true);

-- A creator may maintain their own listing row; they may not touch anyone
-- else's, and they may not create or delete listings.
create policy "creator updates own listing"
  on creator for update to authenticated
  using (id = (select auth_creator_id()))
  with check (id = (select auth_creator_id()));

-- ---------------------------------------------------------------------------
-- Workspace membership
-- ---------------------------------------------------------------------------

create policy "workspace readable by its members"
  on workspace for select to authenticated
  using (id in (select auth_workspace_ids()));

create policy "workspace updated by its members"
  on workspace for update to authenticated
  using (id in (select auth_workspace_ids()))
  with check (id in (select auth_workspace_ids()));

create policy "members readable within a workspace"
  on workspace_member for select to authenticated
  using (workspace_id in (select auth_workspace_ids()));

-- ---------------------------------------------------------------------------
-- Brand side — workspace-scoped, no creator access at all
-- ---------------------------------------------------------------------------

create policy "brand_profile scoped to workspace"
  on brand_profile for all to authenticated
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "icp scoped to workspace"
  on icp for all to authenticated
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "icp_target scoped to its icp's workspace"
  on icp_target for all to authenticated
  using (
    exists (
      select 1 from icp
      where icp.id = icp_target.icp_id
        and icp.workspace_id in (select auth_workspace_ids())
    )
  )
  with check (
    exists (
      select 1 from icp
      where icp.id = icp_target.icp_id
        and icp.workspace_id in (select auth_workspace_ids())
    )
  );

-- CROSSING 1. A campaign is visible only to its own workspace. There is no
-- creator-side policy on this table: a creator reads the brief through their
-- collaboration, never the campaign.
create policy "campaign scoped to workspace"
  on campaign for all to authenticated
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "wallet scoped to workspace"
  on wallet for select to authenticated
  using (workspace_id in (select auth_workspace_ids()));

create policy "ledger_entry scoped to its wallet's workspace"
  on ledger_entry for select to authenticated
  using (
    exists (
      select 1 from wallet
      where wallet.id = ledger_entry.wallet_id
        and wallet.workspace_id in (select auth_workspace_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Collaboration — the only two-sided table
-- ---------------------------------------------------------------------------

-- CROSSING 2. Read access is the union of two disjoint claims: the owning
-- workspace, or the one creator named on the row. A creator with no
-- collaborations matches nothing, because auth_creator_id() returns null for a
-- brand session and creator_id is never null.
create policy "collaboration readable by its workspace or its creator"
  on collaboration for select to authenticated
  using (
    workspace_id in (select auth_workspace_ids())
    or creator_id = (select auth_creator_id())
  );

-- Only a brand invites. A creator cannot manufacture a collaboration and so
-- cannot grant themselves access to a campaign.
create policy "collaboration created by the workspace"
  on collaboration for insert to authenticated
  with check (workspace_id in (select auth_workspace_ids()));

-- Both sides drive the state machine, so both may update the row. Which
-- transitions are legal is enforced in application code and its tests, not
-- here; RLS decides who may touch the row at all.
create policy "collaboration updated by its workspace or its creator"
  on collaboration for update to authenticated
  using (
    workspace_id in (select auth_workspace_ids())
    or creator_id = (select auth_creator_id())
  )
  with check (
    workspace_id in (select auth_workspace_ids())
    or creator_id = (select auth_creator_id())
  );

-- Reused by every table hanging off a collaboration.
create function auth_can_access_collaboration(target uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.collaboration c
    where c.id = target
      and (
        c.workspace_id in (select public.auth_workspace_ids())
        or c.creator_id = (select public.auth_creator_id())
      )
  )
$$;

comment on function auth_can_access_collaboration is
  'True when the session is the collaboration''s workspace or its creator.';

-- The brief is the one piece of campaign data that crosses to the creator, and
-- only for a campaign they have been booked on. PRODUCT.md step 8: the creator
-- sees the brief and writes a draft.
create policy "brief readable by its workspace or a booked creator"
  on brief for select to authenticated
  using (
    exists (
      select 1 from campaign
      where campaign.id = brief.campaign_id
        and campaign.workspace_id in (select auth_workspace_ids())
    )
    or exists (
      select 1 from collaboration c
      where c.campaign_id = brief.campaign_id
        and c.creator_id = (select auth_creator_id())
    )
  );

create policy "brief written by its campaign's workspace"
  on brief for all to authenticated
  using (
    exists (
      select 1 from campaign
      where campaign.id = brief.campaign_id
        and campaign.workspace_id in (select auth_workspace_ids())
    )
  )
  with check (
    exists (
      select 1 from campaign
      where campaign.id = brief.campaign_id
        and campaign.workspace_id in (select auth_workspace_ids())
    )
  );

create policy "collaboration_event readable by either side"
  on collaboration_event for select to authenticated
  using ((select auth_can_access_collaboration(collaboration_id)));

-- Append-only: insert is granted, update and delete are not.
create policy "collaboration_event appended by either side"
  on collaboration_event for insert to authenticated
  with check ((select auth_can_access_collaboration(collaboration_id)));

-- ---------------------------------------------------------------------------
-- Drafts and publishing
-- ---------------------------------------------------------------------------

create policy "draft readable by either side"
  on draft for select to authenticated
  using ((select auth_can_access_collaboration(collaboration_id)));

-- Only the creator writes a draft. A brand reviewing it may read but not edit.
create policy "draft written by its creator"
  on draft for insert to authenticated
  with check (
    exists (
      select 1 from collaboration c
      where c.id = draft.collaboration_id
        and c.creator_id = (select auth_creator_id())
    )
  );

create policy "draft_check readable by either side"
  on draft_check for select to authenticated
  using (
    exists (
      select 1 from draft
      where draft.id = draft_check.draft_id
        and (select auth_can_access_collaboration(draft.collaboration_id))
    )
  );

create policy "draft_check written on a submitted draft"
  on draft_check for insert to authenticated
  with check (
    exists (
      select 1 from draft
      where draft.id = draft_check.draft_id
        and (select auth_can_access_collaboration(draft.collaboration_id))
    )
  );

-- A creator's own LinkedIn posts. Visible to the creator always, and to a
-- brand only once one has been attached to a post on their collaboration.
create policy "creator_post readable by owner or booking workspace"
  on creator_post for select to authenticated
  using (
    creator_id = (select auth_creator_id())
    or exists (
      select 1
      from post p
      join collaboration c on c.id = p.collaboration_id
      where p.creator_post_id = creator_post.id
        and c.workspace_id in (select auth_workspace_ids())
    )
  );

create policy "creator_post written by its creator"
  on creator_post for all to authenticated
  using (creator_id = (select auth_creator_id()))
  with check (creator_id = (select auth_creator_id()));

create policy "post readable by either side"
  on post for select to authenticated
  using ((select auth_can_access_collaboration(collaboration_id)));

-- Publishing is the creator's action (PRODUCT.md step 11).
create policy "post created by its creator"
  on post for insert to authenticated
  with check (
    exists (
      select 1 from collaboration c
      where c.id = post.collaboration_id
        and c.creator_id = (select auth_creator_id())
    )
  );

-- ---------------------------------------------------------------------------
-- Leads — brand side only, reachable only through an owned post
-- ---------------------------------------------------------------------------
--
-- CROSSING 1, transitively. person and company are global: the same person can
-- engage with posts belonging to different workspaces. Visibility therefore
-- cannot be a column comparison and is instead "is there an engagement by this
-- person on a post of a collaboration of mine". Two workspaces can hold rows
-- pointing at the same person and neither learns anything about the other's.
--
-- Creators have no access here at all. PRODUCT.md cuts the creator's own
-- analytics, so the audience data a post produced is the brand's alone.

create policy "engagement readable via an owned post"
  on engagement for select to authenticated
  using (
    exists (
      select 1
      from post p
      join collaboration c on c.id = p.collaboration_id
      where p.id = engagement.post_id
        and c.workspace_id in (select auth_workspace_ids())
    )
  );

create policy "person readable via an engagement on an owned post"
  on person for select to authenticated
  using (
    exists (
      select 1
      from engagement e
      join post p on p.id = e.post_id
      join collaboration c on c.id = p.collaboration_id
      where e.person_id = person.id
        and c.workspace_id in (select auth_workspace_ids())
    )
  );

create policy "company readable via a person who engaged on an owned post"
  on company for select to authenticated
  using (
    exists (
      select 1
      from person pe
      join engagement e on e.person_id = pe.id
      join post p on p.id = e.post_id
      join collaboration c on c.id = p.collaboration_id
      where pe.company_id = company.id
        and c.workspace_id in (select auth_workspace_ids())
    )
  );

-- Scoped through the ICP rather than the person: a match belongs to the
-- workspace whose ICP produced it.
create policy "icp_match scoped to its icp's workspace"
  on icp_match for select to authenticated
  using (
    exists (
      select 1 from icp
      where icp.id = icp_match.icp_id
        and icp.workspace_id in (select auth_workspace_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Indexes the policies depend on
-- ---------------------------------------------------------------------------
--
-- The lead policies walk engagement -> post -> collaboration on every row, and
-- post.collaboration_id is already unique-indexed. These cover the two lookups
-- that were not already indexed for their own sake.

create index if not exists engagement_person_post_idx
  on engagement (person_id, post_id);

create index if not exists person_company_lookup_idx
  on person (company_id)
  where company_id is not null;
