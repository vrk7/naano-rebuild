-- Submitting a draft and publishing the post (PRODUCT.md steps 9 and 11).
--
-- Both are several rows that mean nothing apart, and PostgREST has no
-- cross-statement transaction: a draft with no checks reads as a draft that
-- passed, and a `published` collaboration with no `post` row is a lead source
-- that does not exist.

-- ---------------------------------------------------------------------------
-- What a failing check has to cite
-- ---------------------------------------------------------------------------
--
-- PRODUCT.md: "`draft_check.evidence` is required for any `fail`. A check that
-- cannot point at the span it is judging does not get to fail the draft."
--
-- That rule exists because of the model half. SCOPE.md cuts model-judged checks
-- for v1 precisely because "an LLM scoring 'brief adherence' produces a number
-- nobody can dispute or act on" — and an unciteable failure is exactly that.
--
-- Three of the five deterministic rules judge an *absence*: a required mention
-- that is not there, a link that is not there, a disclosure that is not there.
-- There is no span to quote for any of them. Under the original constraint they
-- could only fail by quoting something they are not judging — evidence for a
-- claim it is not evidence for — or by being downgraded to warnings, which
-- would leave the brief unenforced.
--
-- So the rule keeps its teeth exactly where it bites. A `model` check still
-- cannot fail without citing the span it read. A `deterministic` one may,
-- because its finding is reproducible by anyone holding the draft: "the string
-- 'Atira' does not occur in this text" is falsifiable in a way "this does not
-- follow the brief" is not.

alter table draft_check drop constraint draft_check_fail_needs_evidence;

alter table draft_check add constraint draft_check_fail_needs_evidence
  check (status <> 'fail' or evidence is not null or kind = 'deterministic');

comment on column draft_check.evidence is
  'The span of the draft this judgement is about. Null only where the finding is an absence, and never for a model check that fails.';

-- ---------------------------------------------------------------------------
-- Submitting a draft
-- ---------------------------------------------------------------------------

create function submit_draft(
  p_collaboration_id uuid,
  p_body             text,
  p_checks           jsonb,
  p_steps            jsonb
) returns int
language plpgsql
set search_path = ''
as $$
declare
  v_version  int;
  v_draft_id uuid;
  v_check    jsonb;
begin
  if p_body is null or btrim(p_body) = '' then
    raise exception 'A draft needs a body.'
      using errcode = 'P0001', hint = 'no_body';
  end if;

  -- Computed inside the transaction. Two submits racing would otherwise read
  -- the same max and collide on (collaboration_id, version); here the second
  -- one's transition finds the state already moved and takes its draft with it
  -- when it rolls back.
  select coalesce(max(version), 0) + 1 into v_version
  from public.draft
  where collaboration_id = p_collaboration_id;

  insert into public.draft (collaboration_id, version, body, submitted_by)
  values (p_collaboration_id, v_version, p_body, auth.uid())
  returning id into v_draft_id;

  -- Written before the state moves, so the brand never opens a review and finds
  -- a draft whose checks have not landed yet.
  for v_check in select * from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb))
  loop
    insert into public.draft_check (
      draft_id, rule_key, rule_label, kind, status, evidence, explanation
    )
    values (
      v_draft_id,
      v_check ->> 'ruleKey',
      v_check ->> 'ruleLabel',
      (v_check ->> 'kind')::public.check_kind,
      (v_check ->> 'status')::public.check_status,
      v_check ->> 'evidence',
      v_check ->> 'explanation'
    );
  end loop;

  -- Which transition this is stays in src/lib/collaboration/machine.ts: with
  -- approval required it goes to `in_review`, without it straight to
  -- `approved`. This function is told, and applies it in the same transaction.
  perform public.apply_collaboration_transition(p_collaboration_id, p_steps);

  return v_version;
end;
$$;

comment on function submit_draft is
  'Writes one draft version with its checks and moves the collaboration, in one transaction.';

revoke execute on function submit_draft(uuid, text, jsonb, jsonb) from public;
grant execute on function submit_draft(uuid, text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Publishing
-- ---------------------------------------------------------------------------

-- We do not publish to LinkedIn (SCOPE.md: "Creator pastes a URL. No API."), so
-- the URL is the only evidence the post exists. `creator_post.external_url` is
-- unique, which is what stops one post being recorded against two
-- collaborations and counting its leads twice.
create function publish_collaboration(
  p_collaboration_id uuid,
  p_external_url     text,
  p_body             text,
  p_steps            jsonb
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_creator_id      uuid;
  v_creator_post_id uuid;
  v_post_id         uuid;
  v_now             timestamptz := now();
begin
  if p_external_url is null or btrim(p_external_url) = '' then
    raise exception 'A published post needs its URL.'
      using errcode = 'P0001', hint = 'no_url';
  end if;

  -- RLS returns the row only to the two sides of the collaboration, and the
  -- creator_post insert below is policy-checked against the creator anyway.
  select creator_id into v_creator_id
  from public.collaboration
  where id = p_collaboration_id;

  if v_creator_id is null then
    raise exception 'That collaboration is not one you can publish.'
      using errcode = 'P0001', hint = 'not_found';
  end if;

  begin
    insert into public.creator_post (
      creator_id, external_url, published_at, body, is_sponsored, collaboration_id
    )
    values (v_creator_id, p_external_url, v_now, p_body, true, p_collaboration_id)
    returning id into v_creator_post_id;
  exception when unique_violation then
    raise exception 'That post URL is already recorded against a collaboration.'
      using errcode = 'P0001', hint = 'post_already_recorded';
  end;

  insert into public.post (collaboration_id, creator_post_id, tracked_url, published_at)
  values (
    p_collaboration_id,
    v_creator_post_id,
    -- Null on purpose. Nothing in this build mints a tracked link, and copying
    -- the post's own URL in here would make `tracked_url` look like an
    -- attribution mechanism that does not exist. Attribution is the engagement
    -- on the post, not a click.
    null,
    v_now
  );

  perform public.apply_collaboration_transition(p_collaboration_id, p_steps);

  select id into v_post_id from public.post where collaboration_id = p_collaboration_id;
  return v_post_id;
end;
$$;

comment on function publish_collaboration is
  'Records the creator''s published post and its `post` row, and moves the collaboration, in one transaction.';

revoke execute on function publish_collaboration(uuid, text, text, jsonb) from public;
grant execute on function publish_collaboration(uuid, text, text, jsonb) to authenticated;
