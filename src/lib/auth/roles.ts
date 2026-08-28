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
export const RETURN_TO_PARAM = "returnTo";

/** Fallback when a signed-in session carries no usable role. */
export const DEFAULT_ROLE: Role = "brand";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as ReadonlyArray<string>).includes(value);
}

/**
 * Paths served to everyone, signed in or not: the marketing page, the login
 * screen, and the auth endpoints that run before a session exists.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) return true;
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
 * - a signed-in request for the login screen leaves it, honouring returnTo when
 *   it is safe and points at somewhere this role may actually go
 * - a signed-in request for the other role's area goes to its own home
 */
export function decideRoute(input: {
  pathname: string;
  search: string;
  role: Role | null;
  returnTo: string | null;
}): RouteDecision {
  const { pathname, search, role, returnTo } = input;
  const isLogin = pathname === LOGIN_PATH;

  if (!role) {
    if (isPublicPath(pathname)) return { kind: "allow" };
    const target = `${pathname}${search}`;
    return {
      kind: "redirect",
      to: `${LOGIN_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(target)}`,
    };
  }

  const home = ROLE_HOME[role];

  if (isLogin) {
    const candidate = safeReturnTo(returnTo);
    // A returnTo pointing into the other role's area is dropped rather than
    // followed, or signing in would bounce twice to land somewhere unexpected.
    const wanted = candidate && pathRole(candidate) !== otherRole(role) ? candidate : home;
    return { kind: "redirect", to: wanted };
  }

  const required = pathRole(pathname);
  if (required && required !== role) return { kind: "redirect", to: home };

  return { kind: "allow" };
}

function otherRole(role: Role): Role {
  return role === "brand" ? "creator" : "brand";
}
