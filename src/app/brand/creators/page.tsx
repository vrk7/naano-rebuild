import Link from "next/link";

import { CreatorRow } from "@/components/marketplace/creator-row";
import { loadMarketplace } from "@/lib/marketplace/queries";
import {
  DEFAULT_SORT,
  isSort,
  paginate,
  sortCreators,
  type Sort,
} from "@/lib/marketplace/ranking";
import { quotableValue } from "@/lib/score/creator";

export const metadata = { title: "Creators" };

const SORT_LABEL: Readonly<Record<Sort, string>> = {
  match: "Best match",
  followers: "Most followers",
};

export default async function MarketplacePage({
  searchParams,
}: PageProps<"/brand/creators">) {
  const params = await searchParams;
  const sort = isSort(params.sort) ? params.sort : DEFAULT_SORT;
  const requestedPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);

  const { icps, creators, taxonomy } = await loadMarketplace();

  // Nothing can be scored against nothing. This is the one onboarding step
  // PRODUCT.md says cannot be skipped, so the marketplace says so rather than
  // listing 160 creators at zero.
  if (icps.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Creators</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This workspace has no active ICPs, so there is nothing to score creators
          against. Every number on this page would be meaningless, so there are no
          numbers on this page.
        </p>
      </main>
    );
  }

  const sorted = sortCreators(creators, sort);
  const page = paginate(sorted, requestedPage);
  const stats = summarise(sorted);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Creators</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats.total} creators, each scored against your {icps.length} active{" "}
          {icps.length === 1 ? "ICP" : "ICPs"}. Every card shows the best of those
          scores and says which ICP produced it.
        </p>
      </header>

      {/* The distribution, stated up front. A marketplace whose scores cluster at
          the top is one that cannot say no, and this line is what makes that
          checkable at a glance rather than by scrolling. */}
      <dl className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-border p-4 sm:grid-cols-4">
        <Stat label="Scored" value={`${stats.scored}`} />
        <Stat label="Range" value={stats.range} />
        <Stat label="Median" value={`${stats.median}`} />
        <Stat label="Withheld" value={`${stats.withheld}`} note="sample too thin" />
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-sm">
          <span className="mr-1 text-muted-foreground">Sort</span>
          {(Object.keys(SORT_LABEL) as Sort[]).map((option) => (
            <Link
              key={option}
              href={`/brand/creators?sort=${option}`}
              aria-current={option === sort ? "true" : undefined}
              className={
                option === sort
                  ? "rounded-md bg-muted px-2.5 py-1 font-medium"
                  : "rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted/50"
              }
            >
              {SORT_LABEL[option]}
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Page {page.page} of {page.pageCount}
        </p>
      </div>

      {sort === "followers" ? (
        <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-sm text-pretty text-muted-foreground">
          Sorted by reach, with the match score left in place. This is the ranking
          a follower count gives you on its own — the creators at the top of this
          list are the ones a marketplace without a score would recommend first.
        </p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {page.items.map((entry) => (
          <CreatorRow key={entry.creator.id} entry={entry} taxonomy={taxonomy} />
        ))}
      </ul>

      <Pager sort={sort} page={page.page} pageCount={page.pageCount} />
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
      {note ? <dd className="text-xs text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

function Pager({
  sort,
  page,
  pageCount,
}: {
  sort: Sort;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const link = (target: number) => `/brand/creators?sort=${sort}&page=${target}`;

  return (
    <nav className="mt-8 flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={link(page - 1)} className="underline-offset-4 hover:underline">
          ← Previous
        </Link>
      ) : (
        <span className="text-muted-foreground">← Previous</span>
      )}
      {page < pageCount ? (
        <Link href={link(page + 1)} className="underline-offset-4 hover:underline">
          Next →
        </Link>
      ) : (
        <span className="text-muted-foreground">Next →</span>
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
function summarise(creators: ReadonlyArray<{ best: { score: Parameters<typeof quotableValue>[0] } }>) {
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
    median: values[Math.floor(values.length / 2)],
  };
}
