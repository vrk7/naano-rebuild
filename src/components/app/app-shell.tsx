import Link from "next/link";

import { AppNav, type NavLink } from "./app-nav";
import { Wordmark } from "@/components/marketing/wordmark";

/**
 * The signed-in chrome, shared by both sides of the product.
 *
 * One implementation rather than two near-identical copies: the brand and
 * creator shells had already drifted apart on spacing and on how the sign-out
 * control was styled, and there is nothing about either role that wants a
 * different header.
 *
 * The bar is sticky. These screens are long — a marketplace page runs to a
 * hundred rows — and a header that scrolls away takes the only route out of the
 * screen with it.
 */
export function AppShell({
  links,
  children,
}: {
  links: ReadonlyArray<NavLink>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
        <nav
          aria-label="Main"
          className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-6"
        >
          <Link
            href={links[0].href}
            className="shrink-0 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <Wordmark />
          </Link>

          <span aria-hidden className="h-4 w-px bg-border" />

          <AppNav links={links} />

          <form action="/auth/signout" method="post" className="ml-auto">
            <button
              type="submit"
              className="inline-flex h-7 cursor-pointer items-center rounded-md px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
