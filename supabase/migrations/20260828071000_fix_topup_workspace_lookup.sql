-- topup_wallet used min(ws) to pick the caller's workspace out of
-- auth_workspace_ids(). Postgres has no min() aggregate for uuid, so every call
-- failed with 42883 "function min(uuid) does not exist" before it reached any
-- of the guards below it.
--
-- The count and the pick are two statements now. That is not a workaround: the
-- count is what makes the pick safe, because by the time the select runs there
-- is provably exactly one row to select, and `limit 1` on an unordered set was
-- the thing worth avoiding in the first place.
--
-- Caught by tests/wallet-rpc.test.ts, which exercises the function against the
-- real database. It could not have been caught anywhere else — the body only
-- runs in Postgres.

create or replace function topup_wallet(p_amount_cents bigint)
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
  select count(*) into v_count from auth_workspace_ids();

  if v_count = 0 then
    raise exception 'You are not a member of a workspace.'
      using errcode = 'P0001', hint = 'no_workspace';
  end if;

  -- Exactly one, not the first of several: picking arbitrarily is how money
  -- lands in the wrong wallet. The rest of the app already assumes one
  -- workspace per brand login (loadWallet reads it with maybeSingle).
  if v_count > 1 then
    raise exception 'This login belongs to more than one workspace, so there is no single wallet to top up.'
      using errcode = 'P0001', hint = 'ambiguous_workspace';
  end if;

  -- Guarded to one row above, so this is deterministic.
  select ws into v_workspace_id from auth_workspace_ids() as ws;

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

revoke execute on function topup_wallet(bigint) from public;
grant execute on function topup_wallet(bigint) to authenticated;
