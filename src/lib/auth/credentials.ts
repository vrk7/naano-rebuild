/**
 * Parsing and routing shared by signing in and by both registration branches.
 *
 * Pure, so the rules can be tested without a request. Note what is *not* here:
 * the role. It used to be read out of the form, which meant the value deciding
 * which side of the product you land on arrived from the same untrusted place
 * as everything else. It is now fixed by the route — `/register/brand` and
 * `/register/creator` each pass their own — so a submitted `role` field is
 * simply not read.
 */

import { ROLE_HOME, pathRole, safeReturnTo, type Role } from "./roles";

/** Shortest password Supabase accepts by default. */
export const MIN_PASSWORD_LENGTH = 6;

/** Longest address RFC 5321 allows, and what Postgres will be asked to store. */
const MAX_EMAIL_LENGTH = 320;

export type Credentials = {
  readonly email: string;
  readonly password: string;
  readonly returnTo: string | null;
};

export type ParsedCredentials =
  | { readonly kind: "ok"; readonly value: Credentials }
  | { readonly kind: "invalid"; readonly error: string };

/**
 * Parses the submitted form into a known shape.
 *
 * FormData is untrusted input from a public page, so every field is checked
 * before use rather than cast.
 */
export function parseCredentials(formData: FormData): ParsedCredentials {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || !email.includes("@") || email.length > MAX_EMAIL_LENGTH) {
    return { kind: "invalid", error: "Enter a valid email address." };
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return {
      kind: "invalid",
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const rawReturnTo = formData.get("returnTo");

  return {
    kind: "ok",
    value: {
      email: email.trim(),
      password,
      returnTo: typeof rawReturnTo === "string" ? safeReturnTo(rawReturnTo) : null,
    },
  };
}

/**
 * Where to land after authenticating, honouring returnTo only when it points
 * into this role's own area.
 *
 * `safeReturnTo` has already established that the value is a same-origin path.
 * That is not enough: a path can be well-formed and still lead nowhere. A
 * signed-out visitor who follows a broken link is sent to login carrying it,
 * and following it back afterwards lands them on a 404 having just signed in
 * successfully — which reads as the sign-in failing. So anything outside
 * `/brand` or `/creator` falls back to the role's home, including the public
 * pages, which a session has no reason to be returned to.
 */
export function destinationFor(role: Role, returnTo: string | null): string {
  const home = ROLE_HOME[role];
  if (!returnTo) return home;
  return pathRole(returnTo) === role ? returnTo : home;
}
