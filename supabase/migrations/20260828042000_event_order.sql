-- The event log has to keep its order within a transaction.
--
-- `collaboration_event.at` defaults to now(), which is the *transaction*
-- timestamp. Accepting an invitation writes two events in one transaction —
-- invited -> accepted, then accepted -> drafting — so both carried the same
-- value and ordering by `at` returned them in whichever order the planner
-- chose. Observed: the system's step ahead of the creator's, reading as though
-- drafting began before anyone accepted.
--
-- The log is the history. A history that shuffles is a bug in it, not a display
-- detail, so this is fixed where the rows are written.
--
-- clock_timestamp() is the wall clock at the moment of the insert rather than
-- the start of the transaction, and it is also the more honest reading of the
-- column: `at` is when the step was applied. The rest of the function is
-- unchanged from 20260828041000_collaboration_transitions.sql.

create or replace function apply_collaboration_transition(
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
      raise exception 'This collaboration is no longer in %, or is not yours to move.', v_from
        using errcode = 'P0001', hint = 'stale_state';
    end if;

    insert into public.collaboration_event (
      collaboration_id, from_state, to_state, actor, actor_user_id, note, at
    )
    values (
      p_collaboration_id,
      v_from,
      v_to,
      (v_step ->> 'actor')::public.event_actor,
      case when v_step ->> 'actor' = 'system' then null else auth.uid() end,
      v_step ->> 'note',
      clock_timestamp()
    );

    v_state := v_to;
  end loop;

  return v_state;
end;
$$;
