"use server";

import { redirect } from "next/navigation";

import { destinationFor, parseCredentials } from "@/lib/auth/credentials";
import { parseCreatorListing, type CreatorListingInput } from "@/lib/auth/creator-signup";
import type { Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; notice?: string };

/**
 * Creating the auth user.
 *
 * The role is a parameter, not a form field: it comes from which branch of the
 * role picker the request went through. `assign_signup_role` validates it again
 * in the database and writes the result to app_metadata and the profile row.
 */
async function createAccount(
  email: string,
  password: string,
  role: Role,
): Promise<{ kind: "ok"; userId: string; hasSession: boolean } | { kind: "error"; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role } },
  });

  if (error) return { kind: "error", error: error.message };
  if (!data.user) return { kind: "error", error: "Sign up did not return an account." };

  /*
   * Supabase answers a signup for an existing address with a user object
   * carrying no identities, rather than an error, so an attacker cannot use the
   * signup form to discover who has an account. Mirroring that here means
   * saying the same thing we would say to a genuine new signup, and — the part
   * that matters — not writing a creator listing over somebody else's account.
   */
  if ((data.user.identities?.length ?? 0) === 0) {
    return { kind: "error", error: "Check your email to continue." };
  }

  return { kind: "ok", userId: data.user.id, hasSession: data.session !== null };
}

export async function registerBrand(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (parsed.kind === "invalid") return { error: parsed.error };

  const account = await createAccount(parsed.value.email, parsed.value.password, "brand");
  if (account.kind === "error") return { error: account.error };

  // With email confirmation switched on, signUp returns no session. Saying so
  // is better than redirecting to a page that will bounce straight back.
  if (!account.hasSession) {
    return { error: "Check your email to confirm your account, then sign in." };
  }

  redirect(destinationFor("brand", parsed.value.returnTo));
}

/**
 * Creator signup: account and marketplace listing, in one screen.
 *
 * The listing is written with the service role rather than as the new user.
 * Two reasons, and the second is the binding one:
 *
 *  - `creator` has no insert policy. Listings are seeded, and a creator may
 *    update their own row but not create one, so an RLS-scoped insert would be
 *    denied by design.
 *  - When email confirmation is on, `signUp` returns no session at all. There
 *    is no `auth.uid()` to insert as, and deferring the listing to after
 *    confirmation would mean a second screen — the thing this branch exists to
 *    avoid.
 *
 * Every field written here has been through `parseCreatorListing` first, and
 * `user_id` is the id the auth server just issued rather than anything the
 * caller supplied.
 */
export async function registerCreator(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (parsed.kind === "invalid") return { error: parsed.error };

  const listing = parseCreatorListing(formData);
  if (listing.kind === "invalid") return { error: listing.error };

  const admin = createAdminClient();

  /*
   * Checked before the account is created, not after. linkedin_url is unique,
   * so the insert would fail anyway — but by then there is an auth user with no
   * listing behind it, and the address can never be used to sign up again.
   * A race can still lose here, which is what the rollback below is for.
   */
  const { data: taken, error: lookupError } = await admin
    .from("creator")
    .select("id")
    .eq("linkedin_url", listing.value.linkedinUrl)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not check that profile URL: ${lookupError.message}`);
  }
  if (taken) {
    return { error: "That LinkedIn profile is already listed." };
  }

  const account = await createAccount(parsed.value.email, parsed.value.password, "creator");
  if (account.kind === "error") return { error: account.error };

  const failure = await writeListing(admin, account.userId, listing.value);
  if (failure) {
    /*
     * Roll the account back rather than leave a creator who can sign in and has
     * no listing: every creator-side policy resolves auth.uid() through
     * `creator.user_id`, so that account would see an empty shell forever and
     * could not sign up again with the same address. Deleting is safe because
     * this id was issued moments ago by the call above. `writeListing` has
     * already removed whatever it wrote.
     */
    await admin.auth.admin.deleteUser(account.userId);
    return { error: failure };
  }

  if (!account.hasSession) {
    return {
      error: null,
      notice:
        "Your listing is saved. Check your email to confirm your account, then sign in.",
    };
  }

  redirect(destinationFor("creator", parsed.value.returnTo));
}

/**
 * The three rows a listing is made of.
 *
 * PostgREST has no cross-statement transaction, so these are three round trips
 * that can fail independently and the rollback is explicit. It has to happen
 * here rather than in the caller: `creator.user_id` is `on delete set null`, so
 * deleting the account does *not* take the listing with it. A creator row left
 * behind holds `linkedin_url` — which is unique — and that profile could then
 * never be registered again by anyone, including the person who just failed to.
 *
 * Returns a message rather than throwing, because the caller still has an
 * account to undo before the request ends.
 */
async function writeListing(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  listing: CreatorListingInput,
): Promise<string | null> {
  const { data: creator, error: creatorError } = await admin
    .from("creator")
    .insert({
      user_id: userId,
      display_name: listing.displayName,
      linkedin_url: listing.linkedinUrl,
      // No scrape, so no headline, country or follower count. naano reads those
      // off the profile; we do not, and inventing them would be a worse answer
      // than leaving them empty (SCOPE.md, "The decision everything else hangs
      // on"). followers defaults to 0.
    })
    .select("id")
    .single();

  if (creatorError) return `Could not create your listing: ${creatorError.message}`;

  const undo = async (message: string): Promise<string> => {
    // creator_topic and creator_rate both cascade from creator, so removing the
    // row removes whatever part of the listing did land.
    const { error } = await admin.from("creator").delete().eq("id", creator.id);
    if (error) {
      // The half-written listing is now stuck. Say both things: the original
      // failure, and that it could not be cleaned up — swallowing the second
      // would leave a profile URL silently unusable.
      return `${message}. The partial listing could not be removed either (${error.message}), so this profile URL may stay unavailable.`;
    }
    return message;
  };

  const { error: topicError } = await admin
    .from("creator_topic")
    .insert(listing.topicIds.map((topicId) => ({ creator_id: creator.id, topic_id: topicId })));

  if (topicError) return undo(`Could not save your industries: ${topicError.message}`);

  const { error: rateError } = await admin
    .from("creator_rate")
    .insert({ creator_id: creator.id, kind: "single", price_cents: listing.priceCents });

  if (rateError) return undo(`Could not save your price: ${rateError.message}`);

  return null;
}
