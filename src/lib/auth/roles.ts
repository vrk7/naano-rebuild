/**
 * Roles and route protection.
 *
 * Pure functions with no Supabase or Next dependency, so the routing rules can
 * be tested without a request. proxy.ts supplies the role and the pathname and
 * does what these say.
 */

export const ROLES = ["brand", "creator"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_HOME: Readonly<Record<Role, string>> = {
  brand: "/brand",
  creator: "/creator",
};

export const LOGIN_PATH = "/login";

/**
 * The role picker, and the front door of a two-sided product.
 *
 * `/register` asks which side you are on and branches; `/register/brand` and
 * `/register/creator` are the two branches. The path matches naano's own
 * (`recon/brand/01`), which is the clearest screen it has.
 */
export const REGISTER_PATH = "/register";
export const RETURN_TO_PARAM = "returnTo";

/** Fallback when a signed-in session carries no usable role. */
export const DEFAULT_ROLE: Role = "brand";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as ReadonlyArray<string>).includes(value);
}

/**
 * The screens that exist to get you a session: signing in, and the role picker
 * with its two branches. A signed-in request for one of these is sent home
 * rather than allowed, since it has already answered the question they ask.
 */
export function isAuthScreen(pathname: string): boolean {
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) return true;
  if (pathname === REGISTER_PATH || pathname.startsWith(`${REGISTER_PATH}/`)) return true;
  return false;
}

/**
 * Paths served to everyone, signed in or not: the marketing page, the auth
 * screens, and the auth endpoints that run before a session exists.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (isAuthScreen(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

/** The role a path belongs to, or null when it is not role-scoped. */
export function pathRole(pathname: string): Role | null {
  for (const role of ROLES) {
    const home = ROLE_HOME[role];
    if (pathname === home || pathname.startsWith(`${home}/`)) return role;
  }
  return null;
}

/**
 * Validates a returnTo before it is used in a redirect.
 *
 * Only same-origin paths are allowed. The cases that matter:
 *
 *   //evil.com        protocol-relative — the browser treats this as absolute
 *   /\evil.com        some browsers normalise the backslash to a slash
 *   https://evil.com  plainly absolute
 *   /path\n...        a newline could split a header in a careless handler
 *
 * Anything failing these is dropped rather than corrected, and the caller falls
 * back to the role's home. Returning null rather than "/" keeps the decision
 * with the caller, which knows the role.
 */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // Control characters only, written as escapes: embedding the literal
  // bytes makes the class invisible in an editor, and a literal [ -] would
  // be a space-to-hyphen range that rejects every kebab-case path.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  return raw;
}

export type RouteDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string };

/**
 * The single routing rule, shared by proxy.ts and its tests.
 *
 * - a signed-out request for anything non-public goes to login carrying where
 *   it was headed, so signing in resumes rather than dumping the user at a home
 *   page having forgotten the link they followed
 * - a signed-in request for an auth screen leaves it, honouring returnTo when
 *   it is safe and points at somewhere this role may actually go. That covers
 *   the role picker too: someone who already has a session has already picked
 * - a signed-in request for the other role's area goes to its own home
 */
export function decideRoute(input: {
  pathname: string;
  search: string;
  role: Role | null;
  returnTo: string | null;
}): RouteDecision {
  const { pathname, search, role, returnTo } = input;
  const isAuth = isAuthScreen(pathname);

  if (!role) {
    if (isPublicPath(pathname)) return { kind: "allow" };
    const target = `${pathname}${search}`;
    return {
      kind: "redirect",
      to: `${LOGIN_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(target)}`,
    };
  }

  const home = ROLE_HOME[role];

  if (isAuth) {
    const candidate = safeReturnTo(returnTo);
    // Followed only when it points into this role's own area. The other role's
    // area would bounce twice and land somewhere unexpected; anything outside
    // both is not a place a session belongs, and a well-formed path is not a
    // path that resolves — see destinationFor for the 404 this prevents.
    const wanted = candidate && pathRole(candidate) === role ? candidate : home;
    return { kind: "redirect", to: wanted };
  }

  const required = pathRole(pathname);
  if (required && required !== role) return { kind: "redirect", to: home };

  return { kind: "allow" };
}

