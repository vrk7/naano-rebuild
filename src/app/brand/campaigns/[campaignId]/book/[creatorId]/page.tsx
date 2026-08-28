import Link from "next/link";
import { notFound } from "next/navigation";

import { defaultPostBy, earliestPostBy } from "@/lib/collaboration/booking";
import { STATE_LABEL } from "@/lib/collaboration/machine";
import { loadBookingTarget } from "@/lib/collaboration/queries";
import { loadCampaign } from "@/lib/campaign/queries";

import { BookingForm } from "./booking-form";

export async function generateMetadata({
  params,
}: PageProps<"/brand/campaigns/[campaignId]/book/[creatorId]">) {
  const { campaignId, creatorId } = await params;
  const target = await loadBookingTarget(campaignId, creatorId);
  return { title: target ? `Book ${target.creator.displayName}` : "Book a creator" };
}

/**
 * The offer (PRODUCT.md step 7).
 *
 * Reached from a creator's profile with the campaign in hand, because a booking
 * without a campaign is the dead end naano ends at (`brand/14`): a price with
 * no brief behind it. The campaign and its brief already exist by the time
 * anyone gets here.
 */
export default async function BookCreatorPage({
  params,
}: PageProps<"/brand/campaigns/[campaignId]/book/[creatorId]">) {
  const { campaignId, creatorId } = await params;

  const campaign = await loadCampaign(campaignId);
  // Also the answer when the campaign belongs to another workspace: RLS returns
  // nothing and the page cannot tell the difference, which is the point.
  if (!campaign) notFound();

  const target = await loadBookingTarget(campaignId, creatorId);
  if (!target) notFound();

  const now = new Date();

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link
        href={`/brand/creators/${creatorId}?campaign=${campaignId}`}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← {target.creator.displayName}
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Book {target.creator.displayName}
        </h1>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          On {campaign.name}
          {target.creator.headline ? ` · ${target.creator.headline}` : ""}
        </p>
      </header>

      {target.existing ? (
        /* The database refuses a second live collaboration between one campaign
           and one creator, and so does this page — a brand should not reach a
           form whose submit is already decided. */
        <div className="mt-8 rounded-lg border border-border p-5">
          <p className="text-sm text-pretty">
            {target.creator.displayName} is already booked on this campaign, and that
            collaboration is {STATE_LABEL[target.existing.state].toLowerCase()}. One
            live booking per creator per campaign.
          </p>
          <Link
            href={`/brand/campaigns/${campaignId}`}
            className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
          >
            Back to {campaign.name} →
          </Link>
        </div>
      ) : target.walletBalanceCents === null ? (
        /* Not the same as a zero balance, and it must not read like one: a
           workspace with no wallet has nothing to commit against and topping up
           is not built. Saying "$0" would suggest a button that does not exist. */
        <div className="mt-8 rounded-lg border border-dashed border-border p-5">
          <p className="text-sm text-pretty text-muted-foreground">
            This workspace has no wallet, so there is nothing to commit a booking
            against. Wallets are created with the seeded demo workspace; nothing in
            the product makes one yet.
          </p>
        </div>
      ) : (
        <BookingForm
          campaignId={campaignId}
          creatorId={creatorId}
          creatorName={target.creator.displayName}
          defaultPriceCents={target.creator.priceCents}
          defaultPostBy={defaultPostBy(now)}
          earliestPostBy={earliestPostBy(now)}
          walletBalanceCents={target.walletBalanceCents}
        />
      )}
    </main>
  );
}
