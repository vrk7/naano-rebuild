-- Profiles and the brand/creator role.
--
-- Two places hold the role, deliberately:
--
--   profile.role                  the record, RLS-protected, not user-writable
--   auth.users.raw_app_meta_data  a copy, carried in the JWT
--
-- The copy exists so proxy.ts can route by role without a database round trip
-- on every request. Access tokens are ES256, so the proxy verifies them locally
-- and the role arrives for free. app_metadata is writable only by the service
-- role — a signed-in user cannot change it through the client SDK, unlike
-- user_metadata — so it is safe to route on.
--
-- Routing is not the security boundary regardless. RLS is. A user who somehow
-- carried the wrong role would reach the other side's shell and find it empty,
-- because every table underneath still checks workspace membership or
-- creator identity.

create type profile_role as enum ('brand', 'creator');

create table profile (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         profile_role not null,
  display_name text,
  created_at   timestamptz not null default now()
);

comment on table profile is
  'One row per login. The authoritative role; auth.users.app_metadata carries a copy for routing.';

alter table profile enable row level security;

-- A user reads their own profile and nothing else. There is deliberately no
-- update policy: role changes are an operator action through the service role,
-- not something a session can do to itself.
create policy "profile readable by its owner"
  on profile for select to authenticated
  using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Role assignment at signup
-- ---------------------------------------------------------------------------

-- Runs BEFORE INSERT so the role is already in raw_app_meta_data when the first
-- access token is minted. Doing this after insert would issue one token without
-- a role and route the user wrongly until their next refresh.
create function assign_signup_role()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  resolved  public.profile_role;
begin
  -- raw_user_meta_data is client-supplied at signup, so it is untrusted input.
  -- Anything that is not one of the two roles becomes 'brand' rather than
  -- failing the signup, since the value reaching here is a routing hint.
  if requested is null or requested not in ('brand', 'creator') then
    resolved := 'brand';
  else
    resolved := requested::public.profile_role;
  end if;

  new.raw_app_meta_data :=
    coalesce(new.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', resolved);

  return new;
end;
$$;

create trigger assign_signup_role_trigger
  before insert on auth.users
  for each row execute function assign_signup_role();

-- Reads the role back out of app_metadata rather than re-deriving it, so the
-- table and the token cannot disagree about what was decided above.
create function create_profile_for_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profile (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_app_meta_data ->> 'role', 'brand')::public.profile_role,
    new.raw_user_meta_data ->> 'display_name'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger create_profile_for_user_trigger
  after insert on auth.users
  for each row execute function create_profile_for_user();

-- ---------------------------------------------------------------------------
-- Creator self-claim
-- ---------------------------------------------------------------------------

-- A creator-role profile still has to be attached to a creator row before any
-- creator-side policy matches. Seeded creators have user_id null, so this is
-- how an invited creator claims their listing.
create index profile_role_idx on profile (role);
