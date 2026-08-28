import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { isRole, type Role } from "@/lib/auth/roles";

export type SessionResult = {
  /** Carries any refreshed auth cookies; a redirect must copy them across. */
  response: NextResponse;
  /** Null when signed out, or when a session somehow carries no known role. */
  role: Role | null;
};

/**
 * Refreshes the Supabase auth token and reports the session's role.
 *
 * Server Components cannot set cookies, so this is the only place a refreshed
 * session gets persisted. Without it, tokens expire mid-session and users are
 * logged out at random.
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // Rebuild the response so the refreshed request cookies are visible to
        // whatever renders downstream, then mirror them to the browser.
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Verifies the JWT signature rather than trusting the stored session, and
  // triggers the refresh that populates `setAll` above. Do not replace with
  // `getSession()` — that reads the cookie without validating it.
  const { data, error } = await supabase.auth.getClaims();

  // A failure here means "not signed in as far as we can prove", which is the
  // same routing outcome as having no session at all. It is not swallowed:
  // every protected route then redirects to login rather than rendering.
  if (error || !data?.claims) return { response, role: null };

  // app_metadata is service-role-writable only, unlike user_metadata, so a
  // session cannot promote itself by editing its own profile.
  const claimed = (data.claims.app_metadata as { role?: unknown } | undefined)?.role;

  return { response, role: isRole(claimed) ? claimed : null };
}
