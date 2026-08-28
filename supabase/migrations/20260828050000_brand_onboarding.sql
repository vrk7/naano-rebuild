-- Creating a brand's workspace, and editing its ICPs (PRODUCT.md steps 2–3).
--
-- Two functions, for the two reasons the collaboration ones exist: PostgREST
-- has no cross-statement transaction, and some of these tables deliberately
-- have no insert policy at all.
--
-- `workspace` and `workspace_member` are the second case. Neither can be
-- inserted into by a session — if they could, any account could add itself to
-- any workspace, and RLS everywhere else keys off exactly that membership. So
-- workspace creation is `security definer` and its access rule is its own
-- first statement: you may create a workspace when you are signed in and do not
-- already belong to one.

-- ---------------------------------------------------------------------------
-- Targets, written once
-- ---------------------------------------------------------------------------

-- `icp_target.value` is deliberately heterogeneous (PRODUCT.md, "One
-- taxonomy"): a topic id for industry, ISO-3166 for geo, a slug for the rest.
-- Generation and the editor both speak slugs, because a model cannot know a
-- uuid and a form should not carry one, so the industry mapping happens here —
-- in one place, inside whichever transaction is writing.
create function write_icp_targets(p_icp_id uuid, p_targets jsonb)
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_dimension text;
  v_value     text;
  v_topic_id  uuid;
begin
  -- The editor sends a whole dimension at a time and an empty dimension means
  -- "no longer targeted", so the set is replaced rather than merged. Both
  -- statements are in the caller's transaction, so an ICP is never briefly
  -- untargeted.
  delete from public.icp_target where icp_id = p_icp_id;

  if p_targets is null or jsonb_typeof(p_targets) <> 'object' then
    return;
  end if;

  for v_dimension, v_value in
    select dim.key, val.value
    from jsonb_each(p_targets) as dim
    cross join lateral jsonb_array_elements_text(dim.value) as val(value)
  loop
    if v_dimension = 'industry' then
      select id into v_topic_id from public.topic where slug = v_value;
      if v_topic_id is null then
        raise exception 'There is no industry called %.', v_value
          using errcode = 'P0001', hint = 'unknown_industry';
      end if;
      insert into public.icp_target (icp_id, dimension, value)
      values (p_icp_id, 'industry', v_topic_id::text)
      on conflict (icp_id, dimension, value) do nothing;
    else
      insert into public.icp_target (icp_id, dimension, value)
      values (p_icp_id, v_dimension::public.facet_dimension, v_value)
      on conflict (icp_id, dimension, value) do nothing;
    end if;
  end loop;
end;
$$;

comment on function write_icp_targets is
  'Replaces one ICP''s target set, resolving industry slugs to topic ids.';

-- ---------------------------------------------------------------------------
-- The workspace a brand lands in
-- ---------------------------------------------------------------------------

create function create_brand_workspace(
  p_name    text,
  p_website text,
  p_profile jsonb,
  p_icps    jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user         uuid := auth.uid();
  v_workspace_id uuid;
  v_industry_id  uuid;
  v_icp          jsonb;
  v_icp_id       uuid;
begin
  if v_user is null then
    raise exception 'Only a signed-in account can create a workspace.'
      using errcode = 'P0001', hint = 'no_session';
  end if;

  -- SCOPE.md cuts multi-workspace switching, and everything downstream assumes
  -- one: `currentWorkspaceId()` refuses to guess between two.
  if exists (select 1 from public.workspace_member where user_id = v_user) then
    raise exception 'This account already belongs to a workspace.'
      using errcode = 'P0001', hint = 'already_in_workspace';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'A workspace needs a name.'
      using errcode = 'P0001', hint = 'no_name';
  end if;

  insert into public.workspace (name, website)
  values (btrim(p_name), p_website)
  returning id into v_workspace_id;

  insert into public.workspace_member (workspace_id, user_id, role)
  values (v_workspace_id, v_user, 'owner');

  -- Empty, and deliberately so. Nothing in this build tops a wallet up, and a
  -- starting balance would be money we invented. Booking says what it needs.
  insert into public.wallet (workspace_id, balance_cents)
  values (v_workspace_id, 0);

  -- Null when generation did not produce one. A workspace with no brand
  -- profile is a workspace nobody could describe yet, which is the truth in
  -- that case; a row of placeholders would not be.
  if p_profile is not null then
    select id into v_industry_id from public.topic where slug = p_profile ->> 'industry';
    if v_industry_id is null then
      raise exception 'There is no industry called %.', p_profile ->> 'industry'
        using errcode = 'P0001', hint = 'unknown_industry';
    end if;

    insert into public.brand_profile (
      workspace_id, company_name, website, tagline, value_prop,
      industry_id, size_band, source, generated_at
    )
    values (
      v_workspace_id,
      p_profile ->> 'companyName',
      p_website,
      nullif(p_profile ->> 'tagline', ''),
      nullif(p_profile ->> 'valueProp', ''),
      v_industry_id,
      p_profile ->> 'sizeBand',
      -- `source` says where these words came from, and they were generated.
      -- It flips to 'edited' the day a profile editor exists; the ICP screen
      -- does not touch it, because it does not touch the profile.
      'auto',
      now()
    );
  end if;

  for v_icp in select * from jsonb_array_elements(coalesce(p_icps, '[]'::jsonb))
  loop
    insert into public.icp (workspace_id, rank, label, description, is_active)
    values (
      v_workspace_id,
      (v_icp ->> 'rank')::int,
      v_icp ->> 'label',
      nullif(v_icp ->> 'description', ''),
      true
    )
    returning id into v_icp_id;

    perform public.write_icp_targets(v_icp_id, v_icp -> 'targets');
  end loop;

  return v_workspace_id;
end;
$$;

comment on function create_brand_workspace is
  'Creates a workspace, its owner, its empty wallet, and any generated brand profile and ICPs, atomically.';

revoke execute on function create_brand_workspace(text, text, jsonb, jsonb) from public;
grant execute on function create_brand_workspace(text, text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The ICP editor's one write
-- ---------------------------------------------------------------------------

-- security INVOKER: `icp` and `icp_target` both carry a policy scoped to the
-- caller's workspace, so RLS is already the access rule and this function does
-- not need to repeat it. What it adds is the transaction — the row and its
-- whole target set change together, or not at all.
create function upsert_icp(
  p_icp_id      uuid,
  p_rank        int,
  p_label       text,
  p_description text,
  p_is_active   boolean,
  p_targets     jsonb
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_workspace_ids uuid[];
  v_icp_id        uuid := p_icp_id;
begin
  if p_label is null or btrim(p_label) = '' then
    raise exception 'An ICP needs a name.'
      using errcode = 'P0001', hint = 'no_label';
  end if;

  -- `icp.rank` is checked between 1 and 3 by the table; saying so here gets a
  -- sentence instead of a constraint name.
  if p_rank is null or p_rank < 1 or p_rank > 3 then
    raise exception 'An ICP is ranked 1, 2 or 3.'
      using errcode = 'P0001', hint = 'bad_rank';
  end if;

  if v_icp_id is null then
    -- RLS returns only workspaces this session belongs to, and there is exactly
    -- one. Guessing between two would put an ICP in the wrong place silently.
    select array_agg(id) into v_workspace_ids from public.workspace;
    if v_workspace_ids is null or array_length(v_workspace_ids, 1) <> 1 then
      raise exception 'This account does not belong to exactly one workspace.'
        using errcode = 'P0001', hint = 'no_workspace';
    end if;

    begin
      insert into public.icp (workspace_id, rank, label, description, is_active)
      values (
        v_workspace_ids[1], p_rank, btrim(p_label),
        nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_is_active, true)
      )
      returning id into v_icp_id;
    exception when unique_violation then
      raise exception 'Rank % already belongs to another ICP.', p_rank
        using errcode = 'P0001', hint = 'rank_taken';
    end;
  else
    begin
      update public.icp
      set rank        = p_rank,
          label       = btrim(p_label),
          description = nullif(btrim(coalesce(p_description, '')), ''),
          is_active   = coalesce(p_is_active, true)
      where id = v_icp_id;
    exception when unique_violation then
      raise exception 'Rank % already belongs to another ICP.', p_rank
        using errcode = 'P0001', hint = 'rank_taken';
    end;

    -- No row means no such ICP, or one belonging to another workspace. The
    -- caller learns the same thing either way.
    if not found then
      raise exception 'That ICP is not one you can edit.'
        using errcode = 'P0001', hint = 'not_found';
    end if;
  end if;

  perform public.write_icp_targets(v_icp_id, p_targets);

  return v_icp_id;
end;
$$;

comment on function upsert_icp is
  'Creates or updates one ICP and replaces its target set, in one transaction.';

revoke execute on function upsert_icp(uuid, int, text, text, boolean, jsonb) from public;
grant execute on function upsert_icp(uuid, int, text, text, boolean, jsonb) to authenticated;
