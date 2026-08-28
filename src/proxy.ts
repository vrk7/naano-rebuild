import { NextResponse, type NextRequest } from "next/server";

import { RETURN_TO_PARAM, decideRoute } from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  const { response, role } = await updateSession(request);

  const decision = decideRoute({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    role,
    returnTo: request.nextUrl.searchParams.get(RETURN_TO_PARAM),
  });

  if (decision.kind === "allow") return response;

  const target = new URL(decision.to, request.url);
  const redirect = NextResponse.redirect(target);

  // updateSession may have rotated the auth cookies. Redirecting without
  // carrying them over throws the refreshed session away, which shows up as
  // being logged out at random on exactly the requests that redirect.
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }

  return redirect;
}

export const config = {
  matcher: [
    /*
     * Every path except Next's own static output and image files. Auth cookies
     * are irrelevant to those, and running on them would cost a Supabase round
     * trip per asset.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
