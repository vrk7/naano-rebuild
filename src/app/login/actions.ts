"use server";

import { redirect } from "next/navigation";

import {
  DEFAULT_ROLE,
  ROLE_HOME,
  isRole,
  pathRole,
  safeReturnTo,
  type Role,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

/** Shortest password Supabase accepts by default. */
const MIN_PASSWORD_LENGTH = 6;

type Credentials = {
  email: string;
  password: string;
  role: Role;
  returnTo: string | null;
};

/**
 * Parses the submitted form into a known shape.
 *
 * FormData is untrusted input from a public page, so every field is checked
 * before use rather than cast. An unrecognised role becomes the default instead
 * of failing, matching what the database trigger does with the same value.
 */
function parseCredentials(formData: FormData): Credentials | string {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || !email.includes("@") || email.length > 320) {
    return "Enter a valid email address.";
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  const rawRole = formData.get("role");
  const rawReturnTo = formData.get("returnTo");

  return {
    email: email.trim(),
    password,
    role: isRole(rawRole) ? rawRole : DEFAULT_ROLE,
    returnTo: typeof rawReturnTo === "string" ? safeReturnTo(rawReturnTo) : null,
  };
}

/** Where to land after authenticating, honouring returnTo only when it fits the role. */
function destinationFor(role: Role, returnTo: string | null): string {
  const home = ROLE_HOME[role];
  if (!returnTo) return home;
  const wanted = pathRole(returnTo);
  return wanted === null || wanted === role ? returnTo : home;
}

export async function signIn(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    // Supabase already returns "Invalid login credentials" without saying which
    // half was wrong, which is the behaviour we want; do not add detail.
    return { error: error.message };
  }

  const claimed = (data.user?.app_metadata as { role?: unknown } | undefined)?.role;
  const role = isRole(claimed) ? claimed : DEFAULT_ROLE;

  // redirect throws, so it must sit outside any try/catch.
  redirect(destinationFor(role, parsed.returnTo));
}

export async function signUp(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    // Read by the assign_signup_role trigger, which validates it again in the
    // database and writes the result to app_metadata and the profile row.
    options: { data: { role: parsed.role } },
  });

  if (error) return { error: error.message };

  // With email confirmation switched on, signUp returns no session. Saying so
  // is better than redirecting to a page that will bounce straight back.
  if (!data.session) {
    return { error: "Check your email to confirm your account, then sign in." };
  }

  redirect(destinationFor(parsed.role, parsed.returnTo));
}
