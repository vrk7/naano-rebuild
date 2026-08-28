import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Refreshes the Supabase auth token and writes any rotated cookies onto the
 * outgoing response.
 *
 * Server Components cannot set cookies, so this is the only place a refreshed
 * session gets persisted. Without it, tokens expire mid-session and users are
 * logged out at random.
 */
export async function updateSession(request: NextRequest) {
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
  await supabase.auth.getClaims();

  return response;
}
