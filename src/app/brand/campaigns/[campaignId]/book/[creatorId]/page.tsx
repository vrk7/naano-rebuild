import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { Callout } from "@/components/ui/callout";
import { BackLink, Page, PageHeader } from "@/components/ui/page";
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
    <Page width="narrow">
      <BackLink href={`/brand/creators/${creatorId}?campaign=${campaignId}`}>
        {target.creator.displayName}
      </BackLink>

      <PageHeader
        className="mt-3"
        title={`Book ${target.creator.displayName}`}
        description={`On ${campaign.name}${target.creator.headline ? ` · ${target.creator.headline}` : ""}`}
      />

      {target.existing ? (
        /* The database refuses a second live collaboration between one campaign
           and one creator, and so does this page — a brand should not reach a
           form whose submit is already decided. */
        <Callout tone="note" className="mt-6">
          <p className="text-foreground">
            {target.creator.displayName} is already booked on this campaign, and that
            collaboration is {STATE_LABEL[target.existing.state].toLowerCase()}. One
            live booking per creator per campaign.
          </p>
          <Link
            href={`/brand/campaigns/${campaignId}`}
            className="mt-2 inline-flex items-center gap-1 font-medium"
          >
            Back to {campaign.name}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </Callout>
      ) : target.walletBalanceCents === null ? (
        /* Still not the same as a zero balance. A workspace gets an empty wallet
           when it is created, so reaching this means the row is genuinely absent
           rather than empty — and unlike a zero balance, topping up will not fix
           it, so this does not offer that as the way out. */
        <Callout tone="warning" className="mt-6">
          This workspace has no wallet row at all, so there is nothing to commit a
          booking against. A workspace is created with one, so this is a workspace
          that predates that or had its wallet removed.
        </Callout>
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
    </Page>
  );
}
