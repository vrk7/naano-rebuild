"use server";

import { redirect } from "next/navigation";

import { DEFAULT_ROLE, isRole } from "@/lib/auth/roles";
import { destinationFor, parseCredentials } from "@/lib/auth/credentials";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

/**
 * Signing in only. Creating an account starts at the role picker
 * (`src/app/register`), because which side you are on is the first question a
 * two-sided product has to ask and it is not a checkbox on a login form.
 */
export async function signIn(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (parsed.kind === "invalid") return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.value.email,
    password: parsed.value.password,
  });

  if (error) {
    // Supabase already returns "Invalid login credentials" without saying which
    // half was wrong, which is the behaviour we want; do not add detail.
    return { error: error.message };
  }

  const claimed = (data.user?.app_metadata as { role?: unknown } | undefined)?.role;
  const role = isRole(claimed) ? claimed : DEFAULT_ROLE;

  // redirect throws, so it must sit outside any try/catch.
  redirect(destinationFor(role, parsed.value.returnTo));
}
