-- Topping up a wallet, and releasing a commitment when the window closes
-- (PRODUCT.md steps 14–15, SCOPE.md delivery step 9).
--
-- Both run `security definer` for the reason `book_creator` already records:
-- `wallet` and `ledger_entry` carry select policies and nothing else, because a
-- session that could append to the ledger could write itself a topup. Access
-- control is therefore each function's own first job.
--
-- Neither decides anything about the state machine's shape. `complete_collaboration`
-- enforces one rule the machine also states — the window has to have closed —
-- because it is the rule that stops a brand from releasing its own money early,
-- and a guard that only exists in TypeScript is not a guard on a table anyone
-- can reach with an anon key. Which transitions are legal stays in
-- src/lib/collaboration/machine.ts and its tests.

-- ---------------------------------------------------------------------------
-- Top-up
-- ---------------------------------------------------------------------------

create function topup_wallet(p_amount_cents bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_wallet_id    uuid;
  v_balance      bigint;
  v_count        bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'A top-up has to be a positive amount.'
      using errcode = 'P0001', hint = 'invalid_amount';
  end if;

  -- The caller's workspace, not one they name. There is no argument to forge.
  --
  -- Exactly one, not the first of several: `limit 1` without an order is an
  -- arbitrary pick, and picking arbitrarily is how money lands in the wrong
  -- wallet. The rest of the app already assumes one workspace per brand login
  -- (loadWallet reads it with maybeSingle), so this raises instead of guessing.
  select count(*), min(ws) into v_count, v_workspace_id
  from auth_workspace_ids() as ws;

  if v_count = 0 then
    raise exception 'You are not a member of a workspace.'
      using errcode = 'P0001', hint = 'no_workspace';
  end if;

  if v_count > 1 then
    raise exception 'This login belongs to more than one workspace, so there is no single wallet to top up.'
      using errcode = 'P0001', hint = 'ambiguous_workspace';
  end if;

  select id, balance_cents into v_wallet_id, v_balance
  from public.wallet
  where workspace_id = v_workspace_id;

  if v_wallet_id is null then
    raise exception 'This workspace has no wallet.'
      using errcode = 'P0001', hint = 'no_wallet';
  end if;

  -- Signed: a topup puts money in, so it is positive. Written in the same
  -- transaction as the balance it explains, which is the only thing keeping
  -- the two from drifting apart.
  insert into public.ledger_entry (wallet_id, kind, amount_cents, collaboration_id)
  values (v_wallet_id, 'topup', p_amount_cents, null);

  update public.wallet
  set balance_cents = balance_cents + p_amount_cents
  where id = v_wallet_id
  returning balance_cents into v_balance;

  return v_balance;
end;
$$;

comment on function topup_wallet is
  'Adds a topup ledger entry and moves the wallet balance by the same amount, atomically.';

revoke execute on function topup_wallet(bigint) from public;
grant execute on function topup_wallet(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Completion and release
-- ---------------------------------------------------------------------------

-- The window length is the application's to choose and lives in
-- MEASUREMENT_WINDOW_DAYS, so it arrives as an argument rather than being
-- written twice. When the window *started* is the database's: published_at is a
-- stored timestamp and now() is the transaction clock, so neither is the
-- caller's to move.
create function complete_collaboration(
  p_collaboration_id uuid,
  p_window_days      int
) returns collaboration_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state        collaboration_state;
  v_workspace_id uuid;
  v_price        int;
  v_published_at timestamptz;
  v_wallet_id    uuid;
begin
  select c.state, c.workspace_id, c.price_cents, p.published_at
    into v_state, v_workspace_id, v_price, v_published_at
  from public.collaboration c
  left join public.post p on p.collaboration_id = c.id
  where c.id = p_collaboration_id;

  if v_state is null then
    raise exception 'That collaboration does not exist.'
      using errcode = 'P0001', hint = 'not_found';
  end if;

  -- Membership, checked here rather than trusted from the caller.
  if v_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'That collaboration does not exist.'
      using errcode = 'P0001', hint = 'not_found';
  end if;

  -- Idempotent: closing an already-closed collaboration is not an error, and a
  -- sweep that runs twice must not release the same money twice.
  if v_state = 'completed' then
    return v_state;
  end if;

  if v_state <> 'published' then
    raise exception 'Only a published collaboration can close.'
      using errcode = 'P0001', hint = 'not_published';
  end if;

  if v_published_at is null then
    raise exception 'This collaboration has no publication date to measure from.'
      using errcode = 'P0001', hint = 'no_published_at';
  end if;

  if now() < v_published_at + make_interval(days => p_window_days) then
    raise exception 'The measurement window is still open.'
      using errcode = 'P0001', hint = 'window_open';
  end if;

  -- The state change and its log entry go through apply_collaboration_transition
  -- rather than being written a second time here. That function is documented as
  -- the one place a collaboration changes state, and delegating to it also picks
  -- up its stale-state guard, its clock_timestamp() ordering, and its rule that a
  -- `system` step records no actor_user_id.
  --
  -- The rule is the system's even though a person's request is what ran it: the
  -- window check above means a brand can only ask whether a close is due, never
  -- decide that it is.
  perform apply_collaboration_transition(
    p_collaboration_id,
    jsonb_build_array(
      jsonb_build_object(
        'from', 'published',
        'to', 'completed',
        'actor', 'system',
        'note', null
      )
    )
  );

  select id into v_wallet_id from public.wallet where workspace_id = v_workspace_id;

  -- A release returns what the commit took, so it is the positive mirror of it.
  -- No money moves either way; the ledger records that the hold is over.
  if v_wallet_id is not null then
    insert into public.ledger_entry (wallet_id, kind, amount_cents, collaboration_id)
    values (v_wallet_id, 'release', v_price, p_collaboration_id);

    update public.wallet
    set balance_cents = balance_cents + v_price
    where id = v_wallet_id;
  end if;

  return 'completed'::collaboration_state;
end;
$$;

comment on function complete_collaboration is
  'Closes a published collaboration whose measurement window has passed and releases its commitment.';

revoke execute on function complete_collaboration(uuid, int) from public;
grant execute on function complete_collaboration(uuid, int) to authenticated;
