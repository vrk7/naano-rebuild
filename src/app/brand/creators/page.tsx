import { MarketplaceView } from "@/components/marketplace/marketplace-view";
import { loadMarketplace } from "@/lib/marketplace/queries";
import { DEFAULT_SORT, isSort } from "@/lib/marketplace/ranking";

import { NoIcps } from "./no-icps";

export const metadata = { title: "Creators" };

/**
 * The marketplace, browsed without a campaign.
 *
 * PRODUCT.md step 5 scopes the marketplace to a campaign, and that route is at
 * `/brand/campaigns/[campaignId]/creators`. This one exists because looking at
 * who is available is a reasonable thing to do before deciding what to run —
 * the scores are identical, since they read the workspace's ICPs and not a
 * campaign. What you cannot do from here is book, and the view says so.
 */
export default async function MarketplacePage({
  searchParams,
}: PageProps<"/brand/creators">) {
  const params = await searchParams;
  const sort = isSort(params.sort) ? params.sort : DEFAULT_SORT;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page);

  const { icps, creators, taxonomy } = await loadMarketplace();

  if (icps.length === 0) return <NoIcps />;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <MarketplaceView
        creators={creators}
        icpCount={icps.length}
        taxonomy={taxonomy}
        sort={sort}
        page={page}
        basePath="/brand/creators"
        campaign={null}
        inRegionOnly={false}
      />
    </main>
  );
}
