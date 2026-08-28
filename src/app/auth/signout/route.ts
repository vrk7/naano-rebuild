import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST only. A GET sign-out can be triggered by any image tag or link preview
 * on another site, which logs the user out without them asking.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) throw new Error(`Sign out failed: ${error.message}`);

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
