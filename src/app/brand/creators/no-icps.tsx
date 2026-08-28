import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/callout";
import { Page, PageHeader } from "@/components/ui/page";

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
    <Page>
      <PageHeader title="Creators" />
      <EmptyState
        title="No active ICPs in this workspace"
        className="mt-6"
        action={
          <Button asChild size="lg">
            <Link href="/brand/icps">Set up your ICPs</Link>
          </Button>
        }
      >
        There is nothing to score creators against. Every number on this page would
        be meaningless, so there are no numbers on this page.
      </EmptyState>
    </Page>
  );
}
