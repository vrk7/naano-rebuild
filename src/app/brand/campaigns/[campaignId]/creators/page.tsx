import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketplaceView } from "@/components/marketplace/marketplace-view";
import { NoIcps } from "@/app/brand/creators/no-icps";
import { loadCampaign } from "@/lib/campaign/queries";
import { loadMarketplace } from "@/lib/marketplace/queries";
import { DEFAULT_SORT, isSort } from "@/lib/marketplace/ranking";

export async function generateMetadata({
  params,
}: PageProps<"/brand/campaigns/[campaignId]/creators">) {
  const { campaignId } = await params;
  const campaign = await loadCampaign(campaignId);
  return { title: campaign ? `Creators for ${campaign.name}` : "Creators" };
}

/**
 * The marketplace, scoped to a campaign (PRODUCT.md step 5).
 *
 * What scoping does and does not do is the whole design here. It does not touch
 * the score: that reads the workspace's ICPs, and a campaign does not change who
 * a brand sells to. What it adds is the second question a brand actually has —
 * how much of this creator's audience is where the campaign is running — shown
 * on every card as its own sentence, plus an opt-in filter for the creators who
 * reach none of those regions at all.
 *
 * The filter is off by default and the banner says what it would remove before
 * you turn it on. A marketplace that quietly drops creators is the same failure
 * as one whose score is always high.
 */
export default async function CampaignMarketplacePage({
  params,
  searchParams,
}: PageProps<"/brand/campaigns/[campaignId]/creators">) {
  const { campaignId } = await params;
  const query = await searchParams;

  const campaign = await loadCampaign(campaignId);
  // Also the answer when the campaign belongs to another workspace: RLS returns
  // nothing and the page cannot tell the difference, which is the point.
  if (!campaign) notFound();

  const sort = isSort(query.sort) ? query.sort : DEFAULT_SORT;
  const page = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const inRegionOnly = (Array.isArray(query.region) ? query.region[0] : query.region) === "campaign";

  const { icps, creators, taxonomy } = await loadMarketplace({
    campaignGeos: campaign.geos,
  });

  if (icps.length === 0) return <NoIcps />;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/brand/campaigns/${campaign.id}`}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← {campaign.name}
      </Link>

      <div className="mt-4">
        <MarketplaceView
          creators={creators}
          icpCount={icps.length}
          taxonomy={taxonomy}
          sort={sort}
          page={page}
          basePath={`/brand/campaigns/${campaign.id}/creators`}
          campaign={{
            id: campaign.id,
            name: campaign.name,
            regions: campaign.geos.map((code) => taxonomy.labelFor("geo", code)),
          }}
          inRegionOnly={inRegionOnly}
        />
      </div>
    </main>
  );
}
