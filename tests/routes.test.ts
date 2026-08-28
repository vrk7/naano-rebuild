import { describe, expect, it } from "vitest";

import { destinationFor } from "@/lib/auth/credentials";
import {
  LOGIN_PATH,
  REGISTER_PATH,
  ROLE_HOME,
  decideRoute,
  isPublicPath,
  pathRole,
  safeReturnTo,
} from "@/lib/auth/roles";

/**
 * Route protection, which is access control and so one of the four things
 * CLAUDE.md requires tests for.
 *
 * These cover the proxy's decision, not the proxy itself: decideRoute is pure,
 * so the rules can be stated as a table rather than by building requests. The
 * RLS tests cover the boundary underneath — routing decides what shell you get,
 * the database decides what data is in it.
 */

const signedOut = { role: null } as const;

describe("public paths", () => {
  it("lets anyone reach the marketing page, login and auth endpoints", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/signout")).toBe(true);
  });

  // The role picker is the front door of a two-sided product, so it and both
  // its branches have to be reachable without a session.
  it("lets anyone reach the role picker and both branches", () => {
    expect(isPublicPath(REGISTER_PATH)).toBe(true);
    expect(isPublicPath("/register/brand")).toBe(true);
    expect(isPublicPath("/register/creator")).toBe(true);
  });

  it("treats everything else as protected", () => {
    expect(isPublicPath("/brand")).toBe(false);
    expect(isPublicPath("/creator")).toBe(false);
    expect(isPublicPath("/loginish")).toBe(false);
    expect(isPublicPath("/registerish")).toBe(false);
  });
});

describe("signed out", () => {
  it("is sent to login carrying where it was going", () => {
    const decision = decideRoute({
      pathname: "/brand/campaigns",
      search: "?tab=live",
      ...signedOut,
      returnTo: null,
    });

    expect(decision).toEqual({
      kind: "redirect",
      to: `${LOGIN_PATH}?returnTo=${encodeURIComponent("/brand/campaigns?tab=live")}`,
    });
  });

  it("reaches public pages untouched", () => {
    for (const pathname of ["/", "/login", "/register", "/register/creator"]) {
      expect(
        decideRoute({ pathname, search: "", ...signedOut, returnTo: null }),
      ).toEqual({ kind: "allow" });
    }
  });
});

describe("routing by role", () => {
  it("lets each role into its own area", () => {
    expect(
      decideRoute({ pathname: "/brand/campaigns", search: "", role: "brand", returnTo: null }),
    ).toEqual({ kind: "allow" });
    expect(
      decideRoute({ pathname: "/creator/drafts", search: "", role: "creator", returnTo: null }),
    ).toEqual({ kind: "allow" });
  });

  it("bounces each role out of the other's area", () => {
    expect(
      decideRoute({ pathname: "/creator", search: "", role: "brand", returnTo: null }),
    ).toEqual({ kind: "redirect", to: ROLE_HOME.brand });
    expect(
      decideRoute({ pathname: "/brand", search: "", role: "creator", returnTo: null }),
    ).toEqual({ kind: "redirect", to: ROLE_HOME.creator });
  });

  it("sends a signed-in user away from the login screen", () => {
    expect(
      decideRoute({ pathname: LOGIN_PATH, search: "", role: "creator", returnTo: null }),
    ).toEqual({ kind: "redirect", to: ROLE_HOME.creator });
  });

  // Someone with a session has already answered the question the picker asks,
  // and letting them re-answer it would imply they could switch sides.
  it("sends a signed-in user away from the role picker and its branches", () => {
    for (const pathname of [REGISTER_PATH, "/register/brand", "/register/creator"]) {
      expect(
        decideRoute({ pathname, search: "", role: "creator", returnTo: null }),
      ).toEqual({ kind: "redirect", to: ROLE_HOME.creator });
    }
  });

  it("resumes a safe returnTo after signing in", () => {
    expect(
      decideRoute({
        pathname: LOGIN_PATH,
        search: "",
        role: "brand",
        returnTo: "/brand/campaigns?tab=live",
      }),
    ).toEqual({ kind: "redirect", to: "/brand/campaigns?tab=live" });
  });

  it("ignores a returnTo pointing into the other role's area", () => {
    // Following it would redirect twice and land somewhere the user did not ask
    // for, so it is dropped in favour of their own home.
    expect(
      decideRoute({
        pathname: LOGIN_PATH,
        search: "",
        role: "brand",
        returnTo: "/creator/drafts",
      }),
    ).toEqual({ kind: "redirect", to: ROLE_HOME.brand });
  });

  it("ignores a returnTo pointing outside both role areas", () => {
    // The case that shipped: the marketing header linked to /sign-in, which is
    // not a route. Signed out, the proxy sent it to login as returnTo; signing
    // in then followed it to a 404, so a successful sign-in read as a failure.
    for (const value of ["/sign-in", "/contact", "/", "/register"]) {
      expect(
        decideRoute({ pathname: LOGIN_PATH, search: "", role: "brand", returnTo: value }),
      ).toEqual({ kind: "redirect", to: ROLE_HOME.brand });
    }
  });

  it("maps paths to the role that owns them", () => {
    expect(pathRole("/brand")).toBe("brand");
    expect(pathRole("/brand/x/y")).toBe("brand");
    expect(pathRole("/creator")).toBe("creator");
    expect(pathRole("/")).toBeNull();
    // A prefix match must not capture an unrelated route.
    expect(pathRole("/branding")).toBeNull();
    // /register/brand is an auth screen, not the brand area.
    expect(pathRole("/register/brand")).toBeNull();
  });
});

describe("returnTo cannot redirect off-site", () => {
  const hostile = [
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "http://evil.example",
    "javascript:alert(1)",
    "/ok\nLocation: https://evil.example",
    "",
  ];

  it.each(hostile)("rejects %j", (value) => {
    expect(safeReturnTo(value)).toBeNull();
  });

  it("keeps ordinary paths, including hyphens and query strings", () => {
    expect(safeReturnTo("/brand/some-page")).toBe("/brand/some-page");
    expect(safeReturnTo("/brand?tab=live&sort=score")).toBe("/brand?tab=live&sort=score");
  });

  it("never follows a hostile returnTo out of the login screen", () => {
    for (const value of hostile) {
      const decision = decideRoute({
        pathname: LOGIN_PATH,
        search: "",
        role: "brand",
        returnTo: value,
      });
      expect(decision).toEqual({ kind: "redirect", to: ROLE_HOME.brand });
    }
  });
});

describe("where signing in lands you", () => {
  it("goes home when there is no returnTo", () => {
    expect(destinationFor("brand", null)).toBe(ROLE_HOME.brand);
    expect(destinationFor("creator", null)).toBe(ROLE_HOME.creator);
  });

  it("follows a returnTo into the role's own area", () => {
    expect(destinationFor("brand", "/brand/leads")).toBe("/brand/leads");
    expect(destinationFor("creator", "/creator/collaborations/abc")).toBe(
      "/creator/collaborations/abc",
    );
  });

  it("drops a returnTo the role may not follow", () => {
    expect(destinationFor("brand", "/creator")).toBe(ROLE_HOME.brand);
    expect(destinationFor("creator", "/brand/wallet")).toBe(ROLE_HOME.creator);
  });

  it("drops a well-formed path that is not part of the app", () => {
    // safeReturnTo proves the value is same-origin, not that it resolves.
    for (const value of ["/sign-in", "/contact", "/", "/register/brand"]) {
      expect(destinationFor("brand", value)).toBe(ROLE_HOME.brand);
    }
  });
});
