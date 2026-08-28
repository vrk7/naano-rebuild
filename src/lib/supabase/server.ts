import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * A new client is created per request — never hoist this into a module-level
 * singleton, or one request's session would leak into another's.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components render with a read-only cookie store, so this
          // throws there and only there. Ignoring it is safe *because*
          // `src/proxy.ts` refreshes the session on every matched request
          // and writes the rotated cookies to the response itself. If that
          // middleware is ever removed, this becomes a silent logout bug.
        }
      },
    },
  });
}
