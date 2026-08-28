/**
 * Marketplace ordering and ICP selection.
 *
 * Pure. Given creators already scored against every active ICP, this decides
 * which ICP a card speaks for, what order the cards come in, and which slice of
 * them a page shows. No I/O, so the ordering rules are testable without a
 * database — same reasoning as src/lib/score/creator.ts.
 */

import {
  compareForMarketplace,
  quotableValue,
  type CreatorScore,
} from "@/lib/score/creator";

export type IcpSummary = {
  readonly id: string;
  readonly label: string;
  readonly rank: number;
};

export type CreatorListing = {
  readonly id: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly country: string | null;
  readonly followers: number;
  readonly priceCents: number | null;
  readonly currency: string | null;
  readonly topics: ReadonlyArray<string>;
  readonly sampleSize: number;
  readonly postsAnalyzed: number;
};

export type IcpScore = {
  readonly icp: IcpSummary;
  readonly score: CreatorScore;
};

export type RankedCreator = {
  readonly creator: CreatorListing;
  /** Every active ICP, in rank order, so the profile can show all of them. */
  readonly scores: ReadonlyArray<IcpScore>;
  /** The one the card speaks for. */
  readonly best: IcpScore;
};

/**
 * The ICP a creator looks best against.
 *
 * A brand with three ICPs wants one number per card, and the honest one is the
 * best available — "reaches nobody you sell to" is only true if it holds for
 * every ICP. The card names which one produced it, because a bare number
 * averaged or silently taken from rank 1 would be the same unaccountable
 * constant this build exists to replace.
 *
 * Ties break to the lower rank. Rank is the brand's own statement of which
 * segment matters most, so when two score identically the primary one wins, and
 * the choice is stable rather than dependent on load order.
 */
export function bestIcpScore(
  scores: ReadonlyArray<IcpScore>,
): IcpScore {
  if (scores.length === 0) {
    throw new Error("bestIcpScore needs at least one scored ICP");
  }

  return scores.reduce((best, candidate) => {
    const byScore = compareForMarketplace(candidate.score, best.score);
    if (byScore !== 0) return byScore < 0 ? candidate : best;
    return candidate.icp.rank < best.icp.rank ? candidate : best;
  });
}

export const SORTS = ["match", "followers"] as const;
export type Sort = (typeof SORTS)[number];
export const DEFAULT_SORT: Sort = "match";

export function isSort(value: unknown): value is Sort {
  return typeof value === "string" && (SORTS as ReadonlyArray<string>).includes(value);
}

/**
 * Orders the marketplace.
 *
 * `match` is the default and the argument: score descending, low confidence
 * last. `followers` exists to make the argument visible rather than as a
 * convenience — it is the ranking naano's own marketplace effectively ships,
 * and switching to it puts a 410k-follower creator scoring 10 at the top of the
 * list next to their own score. Two orderings of one list is a cheaper way to
 * show that reach and fit are different things than any amount of copy.
 *
 * Ties break on name so the list does not reshuffle between renders.
 */
export function sortCreators(
  creators: ReadonlyArray<RankedCreator>,
  sort: Sort,
): RankedCreator[] {
  const byName = (a: RankedCreator, b: RankedCreator) =>
    a.creator.displayName.localeCompare(b.creator.displayName);

  if (sort === "followers") {
    return [...creators].sort(
      (a, b) => b.creator.followers - a.creator.followers || byName(a, b),
    );
  }

  return [...creators].sort(
    (a, b) => compareForMarketplace(a.best.score, b.best.score) || byName(a, b),
  );
}

export type Page<T> = {
  readonly items: ReadonlyArray<T>;
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
};

export const PER_PAGE = 24;

/**
 * Slices a sorted list for display.
 *
 * A requested page beyond the end clamps to the last one rather than rendering
 * an empty list, which would read as "no creators match" when the truth is
 * "you asked for page 40 of 7".
 */
export function paginate<T>(
  items: ReadonlyArray<T>,
  requested: number,
  perPage = PER_PAGE,
): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(Math.max(1, Math.trunc(requested) || 1), pageCount);
  const start = (page - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    page,
    pageCount,
    total: items.length,
  };
}

export type ScoreBand = "strong" | "partial" | "weak" | "withheld";

/**
 * How a score reads at a glance.
 *
 * `withheld` is not a band of the number — it is the absence of one. Everything
 * else is shown and labelled, including `weak`, because a marketplace that only
 * renders scores it likes is the constant this product replaces.
 *
 * The boundaries are presentational and deliberately not exported as thresholds
 * anything computes against; ICP_MATCH_THRESHOLD in score/weights.ts is the
 * only number that decides whether something counts.
 */
export function scoreBand(score: CreatorScore): ScoreBand {
  const value = quotableValue(score);
  if (value === null) return "withheld";
  if (value >= 65) return "strong";
  if (value >= 40) return "partial";
  return "weak";
}
