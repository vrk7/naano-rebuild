import Link from "next/link";

import { Wordmark } from "@/components/marketing/wordmark";

/**
 * The brand-side shell.
 *
 * Three links, no tour, no checklist, no nudge toast — SCOPE.md cuts all three
 * because naano runs them at once and they collide. The marketplace has to be
 * reachable for the score to be worth anything, and this is the whole of that.
 */
const LINKS = [
  { href: "/brand", label: "Campaigns" },
  { href: "/brand/creators", label: "Creators" },
  { href: "/brand/posts", label: "Posts" },
  // The ICP editor is not an onboarding screen you pass through once. It is
  // the only place the score's inputs can be corrected, and naano's own open
  // question is whether that is even possible there (recon/NOTES.md).
  { href: "/brand/icps", label: "ICPs" },
] as const;

export default function BrandLayout({ children }: LayoutProps<"/brand">) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/brand" className="shrink-0">
            <Wordmark />
          </Link>
          <ul className="flex items-center gap-4 text-sm">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <form action="/auth/signout" method="post" className="ml-auto">
            <button
              type="submit"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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
