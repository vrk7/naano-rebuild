-- Which columns either side may write on a collaboration.
--
-- RLS decides which rows a session may touch. It cannot decide which columns,
-- and the update policy grants the whole row to both sides — so with the anon
-- key a creator could raise `price_cents` on a booking they had already
-- accepted, move `post_by`, clear `respond_by`, or turn off
-- `approval_required`. The `commit` ledger entry behind the booking would not
-- follow any of it, and the row would then disagree with the money.
--
-- Column privileges are the tool for that. The only writer either side has is
-- `apply_collaboration_transition`, which runs security invoker and touches
-- exactly `state` and `updated_at`. `book_creator` writes the rest of the row
-- as the function owner and is unaffected; so is the seed, which runs as
-- service_role.
--
-- What this does NOT do is make the state machine authoritative. `state` stays
-- writable, so a PATCH straight to 'published' is still refused by
-- src/lib/collaboration/machine.ts and by nothing in the database. Closing that
-- means moving PRODUCT.md's transition table into SQL, which would put the
-- machine in two places and is a larger decision than this one. This narrows
-- the surface to the single column the machine is about.

revoke update on collaboration from authenticated;

grant update (state, updated_at) on collaboration to authenticated;
