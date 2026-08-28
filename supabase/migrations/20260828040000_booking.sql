-- Booking a creator onto a campaign (PRODUCT.md step 7).
--
-- One function rather than four round trips, for two reasons.
--
-- Atomicity. A booking writes the collaboration, its first event, a `commit`
-- ledger entry and the new wallet balance. PostgREST has no cross-statement
-- transaction, and the compensating-delete pattern `createCampaign` uses does
-- not scale to money: a commit entry with no collaboration behind it, or a
-- collaboration nobody paid for, is worse than a failed booking.
--
-- Privilege. `wallet` and `ledger_entry` deliberately carry select policies and
-- nothing else — the ledger is not a table a session gets to append to, or a
-- brand could write itself a topup. So this runs `security definer`, which
-- makes access control its own first job: the campaign has to belong to a
-- workspace the caller is a member of, and every other row it touches is
-- reached from that campaign rather than from an argument.
--
-- What it does NOT do is decide anything about the state machine. It writes the
-- one state a booking can start in. Which transitions are legal afterwards
-- stays in src/lib/collaboration/machine.ts and its tests, as the RLS migration
-- already records.

create function book_creator(
  p_campaign_id       uuid,
  p_creator_id        uuid,
  p_price_cents       int,
  p_post_by           date,
  p_approval_required boolean,
  p_respond_hours     int
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id     uuid;
  v_wallet_id        uuid;
  v_balance          bigint;
  v_collaboration_id uuid;
begin
  -- Access control first, and by lookup rather than by argument: the caller
  -- names a campaign, and the workspace comes from the row.
  select workspace_id into v_workspace_id
  from public.campaign
  where id = p_campaign_id;

  if v_workspace_id is null then
    raise exception 'That campaign does not exist.'
      using errcode = 'P0001', hint = 'no_campaign';
  end if;

  if v_workspace_id not in (select public.auth_workspace_ids()) then
    -- Same message as above on purpose. A caller who is not a member does not
    -- get to learn that the id was real.
    raise exception 'That campaign does not exist.'
      using errcode = 'P0001', hint = 'no_campaign';
  end if;

  if not exists (select 1 from public.creator where id = p_creator_id) then
    raise exception 'That creator is not listed.'
      using errcode = 'P0001', hint = 'no_creator';
  end if;

  if p_price_cents is null or p_price_cents <= 0 then
    raise exception 'A booking commits a price.'
      using errcode = 'P0001', hint = 'no_price';
  end if;

  if p_respond_hours is null or p_respond_hours <= 0 then
    raise exception 'A booking needs a window for the creator to answer in.'
      using errcode = 'P0001', hint = 'no_respond_window';
  end if;

  if p_post_by is not null and p_post_by < current_date then
    raise exception 'That post date has already passed.'
      using errcode = 'P0001', hint = 'post_by_passed';
  end if;

  -- The wallet lock comes before the duplicate check, not after. It serialises
  -- every booking in this workspace, so two submits of the same form cannot
  -- both read "not booked yet" and both commit the price.
  select id, balance_cents into v_wallet_id, v_balance
  from public.wallet
  where workspace_id = v_workspace_id
  for update;

  if v_wallet_id is null then
    raise exception 'This workspace has no wallet, so nothing can be committed against it.'
      using errcode = 'P0001', hint = 'no_wallet';
  end if;

  -- The four states a collaboration stops in. Mirrors TERMINAL_STATES in
  -- src/lib/collaboration/machine.ts: anything else is still live, and a
  -- creator cannot be booked twice on one campaign while it is.
  if exists (
    select 1
    from public.collaboration
    where campaign_id = p_campaign_id
      and creator_id = p_creator_id
      and state not in ('completed', 'declined', 'expired', 'cancelled')
  ) then
    raise exception 'This creator is already booked on this campaign.'
      using errcode = 'P0001', hint = 'already_booked';
  end if;

  if v_balance < p_price_cents then
    raise exception 'This booking commits % but the wallet holds %.',
        p_price_cents, v_balance
      using errcode = 'P0001', hint = 'insufficient_funds';
  end if;

  insert into public.collaboration (
    campaign_id, creator_id, workspace_id, state,
    price_cents, post_by, respond_by, approval_required
  )
  values (
    p_campaign_id, p_creator_id, v_workspace_id, 'invited',
    p_price_cents, p_post_by,
    -- now() is the transaction timestamp, so the deadline is measured by the
    -- database clock rather than the caller's. The number of hours is the
    -- application's to choose; when it starts is not.
    now() + make_interval(hours => p_respond_hours),
    p_approval_required
  )
  returning id into v_collaboration_id;

  -- The log opens with the state the row was created in. from_state is null
  -- because there was nothing before it.
  insert into public.collaboration_event (collaboration_id, from_state, to_state, actor, actor_user_id)
  values (v_collaboration_id, null, 'invited', 'brand', auth.uid());

  -- Signed: a commit takes money out of the wallet, so it is negative.
  insert into public.ledger_entry (wallet_id, kind, amount_cents, collaboration_id)
  values (v_wallet_id, 'commit', -p_price_cents, v_collaboration_id);

  -- Written in the same transaction as the entry that explains it, which is the
  -- only thing keeping balance_cents and the ledger from drifting apart.
  update public.wallet
  set balance_cents = balance_cents - p_price_cents
  where id = v_wallet_id;

  return v_collaboration_id;
end;
$$;

comment on function book_creator is
  'Creates a collaboration in `invited` and commits its price against the workspace wallet, atomically.';

-- Definer functions are executable by PUBLIC by default, which would let an
-- anonymous request reach the body. It would fail the membership check, but the
-- narrower grant says who this is for.
revoke execute on function book_creator(uuid, uuid, int, date, boolean, int) from public;
grant execute on function book_creator(uuid, uuid, int, date, boolean, int) to authenticated;
