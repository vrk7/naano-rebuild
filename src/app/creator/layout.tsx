import Link from "next/link";

import { Wordmark } from "@/components/marketing/wordmark";

/**
 * The creator-side shell.
 *
 * One link, because there is one thing here: the collaborations they have been
 * booked on. SCOPE.md cuts the creator's own analytics, their earnings and the
 * affiliate surface, so a second nav item would have to be invented before it
 * could be shown.
 *
 * It exists mostly for the third item — signing out. The brand side has had a
 * shell since it had two screens; the creator side grew to two and did not,
 * which left an account with no way to leave it.
 */
export default function CreatorLayout({ children }: LayoutProps<"/creator">) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/creator" className="shrink-0">
            <Wordmark />
          </Link>
          <ul className="flex items-center gap-4 text-sm">
            <li>
              <Link
                href="/creator"
                className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Collaborations
              </Link>
            </li>
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
