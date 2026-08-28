import Link from "next/link";

/**
 * Nothing can be scored against nothing.
 *
 * Shared by both marketplace routes. This is the one onboarding step PRODUCT.md
 * says cannot be skipped, so the marketplace says so rather than listing 160
 * creators at zero — a zero would be a claim about the creators when the truth
 * is that no question was asked.
 */
export function NoIcps() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Creators</h1>
      <p className="mt-4 text-sm text-pretty text-muted-foreground">
        This workspace has no active ICPs, so there is nothing to score creators
        against. Every number on this page would be meaningless, so there are no
        numbers on this page.
      </p>
      <Link
        href="/brand/icps"
        className="mt-4 inline-block rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
      >
        Set up your ICPs →
      </Link>
    </main>
  );
}
