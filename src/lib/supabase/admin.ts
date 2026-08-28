import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL, requireServiceRoleKey } from "@/lib/env";

/**
 * Service-role client. Bypasses row level security entirely, so it is only for
 * trusted server work such as seeding and migrations-adjacent scripts — never
 * for handling a request on behalf of a signed-in user.
 *
 * The `server-only` import above makes importing this from a Client Component
 * a build error rather than a leaked secret.
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
