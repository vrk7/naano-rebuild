-- Links a creator to a login.
--
-- PRODUCT.md has no creator signup: creators "arrive by invitation to a
-- collaboration and land in a thin workspace" (SCOPE.md, cut list). The schema
-- therefore had no path from auth.uid() to a creator row, which makes the rule
-- "a creator only sees collaborations they are on" impossible to express as a
-- policy. This column is that path.
--
-- Nullable on purpose: the 160 seeded creators are marketplace listings with no
-- account behind them, and a creator only gains one when they accept an
-- invitation. A null user_id means "listed, never signed in", and matches no
-- session.

alter table creator
  add column user_id uuid unique references auth.users (id) on delete set null;

-- Every creator-side policy resolves auth.uid() to a creator through this
-- column, so it sits on the hot path for those checks.
create index creator_user_idx on creator (user_id) where user_id is not null;

comment on column creator.user_id is
  'Login backing this creator. Null until they accept an invitation.';
