-- Moving a collaboration, and logging the move (PRODUCT.md, "Collaboration
-- state machine").
--
-- This function is deliberately dumb about which transitions are legal. That
-- decision lives in src/lib/collaboration/machine.ts, where it is a pure
-- function with PRODUCT.md's table under test, and the RLS migration already
-- records the reasoning: "Which transitions are legal is enforced in
-- application code and its tests, not here; RLS decides who may touch the row
-- at all."
--
-- What it adds is the two things application code cannot do over PostgREST:
--
--   Atomicity. A state change and its event row land together or not at all.
--   `collaboration_event` is the history — a state that moved without a line in
--   the log, or a line describing a move that did not happen, is worse than a
--   failed transition.
--
--   A concurrency guard. Each step updates only if the row is still in the
--   state the caller read, so two accepts of one invitation cannot both win.
--
-- It runs security INVOKER, so RLS still decides whose rows these are: the
-- owning workspace or the one creator named on the collaboration.

create function apply_collaboration_transition(
  p_collaboration_id uuid,
  p_steps            jsonb
) returns public.collaboration_state
language plpgsql
set search_path = ''
as $$
declare
  v_step  jsonb;
  v_from  public.collaboration_state;
  v_to    public.collaboration_state;
  v_state public.collaboration_state;
begin
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) = 0 then
    raise exception 'A transition needs at least one step.'
      using errcode = 'P0001', hint = 'no_steps';
  end if;

  -- More than one step when a state is passed straight through: accepting an
  -- invitation moves invited -> accepted -> drafting, and PRODUCT.md gives the
  -- second step to the system. Both land in this transaction or neither does,
  -- so nothing can come to rest in `accepted`.
  for v_step in select * from jsonb_array_elements(p_steps)
  loop
    v_from := (v_step ->> 'from')::public.collaboration_state;
    v_to   := (v_step ->> 'to')::public.collaboration_state;

    update public.collaboration
    set state = v_to,
        updated_at = now()
    where id = p_collaboration_id
      and state = v_from;

    if not found then
      -- Both readings are true and neither is worth distinguishing to the
      -- caller: the row moved under them, or it was never theirs to move.
      raise exception 'This collaboration is no longer in %, or is not yours to move.', v_from
        using errcode = 'P0001', hint = 'stale_state';
    end if;

    insert into public.collaboration_event (
      collaboration_id, from_state, to_state, actor, actor_user_id, note
    )
    values (
      p_collaboration_id,
      v_from,
      v_to,
      (v_step ->> 'actor')::public.event_actor,
      -- A system step has no person behind it, and naming the user who
      -- happened to trigger it would say the creator expired their own
      -- invitation.
      case when v_step ->> 'actor' = 'system' then null else auth.uid() end,
      v_step ->> 'note'
    );

    v_state := v_to;
  end loop;

  return v_state;
end;
$$;

comment on function apply_collaboration_transition is
  'Applies an ordered list of state changes and appends one event per change, in one transaction. Legality is decided in application code.';

revoke execute on function apply_collaboration_transition(uuid, jsonb) from public;
grant execute on function apply_collaboration_transition(uuid, jsonb) to authenticated;
