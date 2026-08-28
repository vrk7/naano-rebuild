import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CreatorRow } from "./creator-row";
import { Callout } from "@/components/ui/callout";
import { Metric, MetricRow } from "@/components/ui/metric";
import { PageHeader } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { reachesCampaign } from "@/lib/campaign/reach";
import {
  paginate,
  sortCreators,
  type RankedCreator,
  type Sort,
} from "@/lib/marketplace/ranking";
import { quotableValue } from "@/lib/score/creator";
import type { TaxonomyLookup } from "@/lib/score/labels";

const SORT_LABEL: Readonly<Record<Sort, string>> = {
  match: "Best match",
  followers: "Most followers",
};

export type CampaignContext = {
  readonly id: string;
  readonly name: string;
  /** Regions in English, already resolved. Empty means no restriction. */
  readonly regions: ReadonlyArray<string>;
};

export type MarketplaceViewProps = {
  readonly creators: ReadonlyArray<RankedCreator>;
  readonly icpCount: number;
  readonly taxonomy: TaxonomyLookup;
  readonly sort: Sort;
  readonly page: number;
  /** Where the sort, filter and pager links point. */
  readonly basePath: string;
  /** Null when browsing without a campaign. */
  readonly campaign: CampaignContext | null;
  /** Whether the campaign-region filter is on. */
  readonly inRegionOnly: boolean;
};

/**
 * The marketplace list, shared by the campaign-scoped route and the plain
 * browse.
 *
 * One implementation on purpose: two would drift, and the thing that must stay
 * identical between them is the part that makes the argument — scores vary, low
 * confidence sorts last, and low scores are shown and labelled rather than
 * hidden. A campaign adds context and an opt-in filter around that list; it
 * never changes a number in it.
 */
export function MarketplaceView({
  creators,
  icpCount,
  taxonomy,
  sort,
  page,
  basePath,
  campaign,
  inRegionOnly,
}: MarketplaceViewProps) {
  const outOfRegion = creators.filter((entry) => !reachesCampaign(entry.campaignReach ?? { kind: "untargeted" }));
  const visible = inRegionOnly
    ? creators.filter((entry) => reachesCampaign(entry.campaignReach ?? { kind: "untargeted" }))
    : creators;

  const sorted = sortCreators(visible, sort);
  const slice = paginate(sorted, page);
  const stats = summarise(sorted);

  const link = (params: { sort?: Sort; page?: number; region?: boolean }) => {
    const query = new URLSearchParams();
    const nextSort = params.sort ?? sort;
    const nextRegion = params.region ?? inRegionOnly;
    if (nextSort !== "match") query.set("sort", nextSort);
    if (nextRegion) query.set("region", "campaign");
    if (params.page && params.page > 1) query.set("page", String(params.page));
    const suffix = query.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  };

  return (
    <>
      <PageHeader
        title="Creators"
        description={`${stats.total} creators, each scored against your ${icpCount} active ${
          icpCount === 1 ? "ICP" : "ICPs"
        }. Every card shows the best of those scores and says which ICP produced it.`}
      />

      {campaign ? (
        <CampaignBanner campaign={campaign} outOfRegion={outOfRegion.length} />
      ) : (
        <Callout tone="empty" className="mt-4">
          Browsing without a campaign. Scores are the same either way — they read your
          ICPs, not a campaign — but booking attaches a creator to a campaign, so
          start from <Link href="/brand">one of yours</Link> when you are ready to book.
        </Callout>
      )}

      {/* The distribution, stated up front. A marketplace whose scores cluster at
          the top is one that cannot say no, and this line is what makes that
          checkable at a glance rather than by scrolling. */}
      <MetricRow className="mt-6">
        <Metric label="Scored" value={stats.scored} />
        <Metric label="Range" value={stats.range} />
        <Metric label="Median" value={stats.median} />
        <Metric label="Withheld" value={stats.withheld} note="sample too thin" />
      </MetricRow>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Sort</span>
          {/* One bordered track with the active segment filled, rather than two
              links that only differ by weight. The control now looks like a
              control, and which option is live is legible without comparing. */}
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {(Object.keys(SORT_LABEL) as Sort[]).map((option) => (
              <Link
                key={option}
                href={link({ sort: option, page: 1 })}
                aria-current={option === sort ? "true" : undefined}
                className={cn(
                  "inline-flex h-6 items-center rounded-[5px] px-2 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                  option === sort
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {SORT_LABEL[option]}
              </Link>
            ))}
          </div>
        </div>
        <p className="num text-xs tabular-nums text-muted-foreground">
          Page {slice.page} of {slice.pageCount}
        </p>
      </div>

      {sort === "followers" ? (
        <Callout tone="note" className="mt-3">
          Sorted by reach, with the match score left in place. This is the ranking
          a follower count gives you on its own — the creators at the top of this
          list are the ones a marketplace without a score would recommend first.
        </Callout>
      ) : null}

      <ul className="mt-4 space-y-2">
        {slice.items.map((entry) => (
          <CreatorRow
            key={entry.creator.id}
            entry={entry}
            taxonomy={taxonomy}
            campaignId={campaign?.id ?? null}
          />
        ))}
      </ul>

      {slice.items.length === 0 ? (
        <Callout tone="empty" className="mt-4 py-6 text-center">
          No creators reach this campaign&rsquo;s regions.{" "}
          <Link href={link({ region: false, page: 1 })}>Show the rest</Link> to see who
          was filtered out and why.
        </Callout>
      ) : null}

      <Pager link={link} page={slice.page} pageCount={slice.pageCount} />
    </>
  );
}

/**
 * What scoping to a campaign actually does, said plainly.
 *
 * The filter is off by default and says how many it would remove before it is
 * turned on. A marketplace that quietly hides the creators it thinks you should
 * not see is the same failure as one whose score is always high — the brand has
 * to be able to look at what was excluded.
 */
function CampaignBanner({
  campaign,
  outOfRegion,
}: {
  campaign: CampaignContext;
  outOfRegion: number;
}) {
  return (
    <Callout tone="note" className="mt-4">
      <p className="text-sm text-foreground">
        Scoped to{" "}
        <Link href={`/brand/campaigns/${campaign.id}`} className="font-medium">
          {campaign.name}
        </Link>
        . Booking from here attaches the creator to it.
      </p>
      <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
        {campaign.regions.length === 0
          ? "This campaign names no regions, so nothing is filtered by geography. Each card still shows how the audience matches your ICPs."
          : `Running in ${campaign.regions.join(", ")}. Each card shows how much of that creator's audience is actually there — which is a different question from the ICP score, and the two can disagree.`}
      </p>
      {outOfRegion > 0 ? (
        <p className="mt-2 text-sm">
          <span>
            {outOfRegion} {outOfRegion === 1 ? "creator reaches" : "creators reach"} none of
            those regions.
          </span>{" "}
          <Link
            href={`/brand/campaigns/${campaign.id}/creators?region=campaign`}
            className="font-medium"
          >
            Hide them
          </Link>
        </p>
      ) : null}
    </Callout>
  );
}

function Pager({
  link,
  page,
  pageCount,
}: {
  link: (params: { page?: number }) => string;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  // A disabled end of the range is rendered as a non-link rather than being
  // removed, so the pair does not shift sideways between page 1 and page 2.
  const step =
    "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25";
  const enabled = "border-border text-foreground hover:bg-muted";
  const disabled = "border-transparent text-muted-foreground/60";

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
      {page > 1 ? (
        <Link href={link({ page: page - 1 })} className={cn(step, enabled)}>
          <ChevronLeft aria-hidden className="size-3.5" />
          Previous
        </Link>
      ) : (
        <span className={cn(step, disabled)}>
          <ChevronLeft aria-hidden className="size-3.5" />
          Previous
        </span>
      )}
      {page < pageCount ? (
        <Link href={link({ page: page + 1 })} className={cn(step, enabled)}>
          Next
          <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      ) : (
        <span className={cn(step, disabled)}>
          Next
          <ChevronRight aria-hidden className="size-3.5" />
        </span>
      )}
    </nav>
  );
}

/**
 * The shape of the distribution.
 *
 * Only quotable scores go into the range and the median — a withheld score is
 * not a low one, and averaging it in would put a number on exactly the samples
 * we refused to put a number on.
 */
function summarise(creators: ReadonlyArray<RankedCreator>) {
  const values = creators
    .map((entry) => quotableValue(entry.best.score))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return {
      total: creators.length,
      scored: 0,
      withheld: creators.length,
      range: "—",
      median: "—",
    };
  }

  return {
    total: creators.length,
    scored: values.length,
    withheld: creators.length - values.length,
    range: `${values[0]}–${values[values.length - 1]}`,
    median: `${values[Math.floor(values.length / 2)]}`,
  };
}
