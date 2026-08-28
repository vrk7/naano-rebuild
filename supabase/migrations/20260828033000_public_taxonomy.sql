-- The taxonomy has to be readable without a session.
--
-- Creator signup is one screen and it asks for up to three industries
-- (PRODUCT.md, "Signup"). That screen is public by definition — you are on it
-- because you do not have an account — so the chips it renders come from a
-- table an anonymous request has to be able to select from.
--
-- `topic` is 40 rows of industry and function labels. It carries no workspace,
-- no personal data and nothing derived from either; it is the shared vocabulary
-- PRODUCT.md's "One taxonomy" section exists to establish. Making it publicly
-- readable is therefore a statement of what it is, and is preferable to routing
-- a public read through the service role, which would put the decision in
-- application code instead of in a policy.
--
-- The existing "topic readable when signed in" policy stays. Policies are
-- permissive and OR together, and dropping it would leave the authenticated
-- role relying on this one by accident rather than on purpose.

create policy "topic readable by anyone"
  on topic for select to anon using (true);
