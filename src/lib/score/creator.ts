/**
 * The match scoring engine (PRODUCT.md, "Match score").
 *
 * Pure. No I/O, no database, no formatting of anything the caller has to
 * render. It takes an audience snapshot and a set of ICP targets and returns a
 * value, a confidence, and the working.
 *
 *   score(creator, icp) -> { value: 0..100, confidence, breakdown[] }
 *
 * The point of the breakdown is that a brand can read why a creator scored 31
 * without opening anything else, so it is part of the return value rather than
 * something a caller recomputes.
 */

import {
  DIMENSION_WEIGHTS,
  SCORE_DIMENSIONS,
  confidenceFor,
  type Confidence,
  type ScoreDimension,
} from "./weights.ts";

export type AudienceFacet = {
  readonly dimension: ScoreDimension;
  /** Topic id for industry, ISO-3166 for geo, a slug for the rest. */
  readonly value: string;
  /** Share of the observed audience, 0..1. */
  readonly share: number;
};

export type AudienceSnapshot = {
  readonly sampleSize: number;
  readonly postsAnalyzed: number;
  readonly facets: ReadonlyArray<AudienceFacet>;
};

export type IcpTarget = {
  readonly dimension: ScoreDimension;
  readonly value: string;
};

export type DimensionBreakdown = {
  readonly dimension: ScoreDimension;
  readonly targets: ReadonlyArray<string>;
  /** Share of this audience inside the target set, 0..1. */
  readonly overlap: number;
  /** Renormalised weight, so the weights across scored dimensions sum to 1. */
  readonly weight: number;
  /** Points this dimension contributed, out of 100. */
  readonly contribution: number;
  /** Points this dimension gave up. weight x (1 - overlap) x 100. */
  readonly lost: number;
  /**
   * False when the snapshot held no facets at all for this dimension. Overlap
   * is then 0, which is arithmetically the same as a total miss but means
   * something different — we have no data rather than bad data.
   */
  readonly observed: boolean;
  /** Plain-language miss, or null when the audience is entirely on target. */
  readonly detractor: string | null;
};

export type CreatorScore =
  | {
      readonly kind: "scored";
      readonly value: number;
      readonly confidence: Confidence;
      readonly breakdown: ReadonlyArray<DimensionBreakdown>;
      /** The dimension costing the most points, in words. */
      readonly largestDetractor: string | null;
    }
  | {
      /**
       * An ICP with no targets in any dimension cannot produce a score. This is
       * not zero: zero says "this creator matches nothing you asked for", and
       * the truth is that nothing was asked for. Callers have to handle it.
       */
      readonly kind: "unscoreable";
      readonly reason: "icp-has-no-targets";
      readonly confidence: Confidence;
    };

/** How a miss reads for each dimension. */
const DETRACTOR_PHRASING: Readonly<Record<ScoreDimension, string>> = {
  geo: "outside your target regions",
  job_function: "in other job functions",
  seniority: "at other seniority levels",
  industry: "in other industries",
};

function detractorFor(dimension: ScoreDimension, overlap: number): string | null {
  const missed = Math.round((1 - overlap) * 100);
  if (missed <= 0) return null;
  return `${missed}% of this audience is ${DETRACTOR_PHRASING[dimension]}`;
}

/**
 * Rejects malformed shares rather than scoring around them.
 *
 * A negative or NaN share is a data bug, and silently treating it as zero would
 * produce a confident number off broken input — the exact failure this whole
 * build exists to correct.
 */
function assertValidShare(facet: AudienceFacet): void {
  if (!Number.isFinite(facet.share) || facet.share < 0 || facet.share > 1) {
    throw new Error(
      `audience_facet share must be between 0 and 1, got ${facet.share} ` +
        `for ${facet.dimension}=${facet.value}`,
    );
  }
}

function targetsByDimension(
  targets: ReadonlyArray<IcpTarget>,
): Map<ScoreDimension, Set<string>> {
  const grouped = new Map<ScoreDimension, Set<string>>();

  for (const target of targets) {
    const existing = grouped.get(target.dimension);
    if (existing) {
      existing.add(target.value);
      continue;
    }
    grouped.set(target.dimension, new Set([target.value]));
  }

  return grouped;
}

/**
 * Sums the shares of this audience that fall inside the target set.
 *
 * Clamped to 1 because audience_facet rows are stored to four decimal places
 * and a dimension whose shares sum to 1.0000 can land a hair above it once
 * added as floats. Clamping keeps an overlap from ever contributing more than
 * its weight allows.
 */
function overlapFor(
  facets: ReadonlyArray<AudienceFacet>,
  dimension: ScoreDimension,
  targets: ReadonlySet<string>,
): { overlap: number; observed: boolean } {
  let overlap = 0;
  let observed = false;

  for (const facet of facets) {
    if (facet.dimension !== dimension) continue;
    assertValidShare(facet);
    observed = true;
    if (targets.has(facet.value)) overlap += facet.share;
  }

  return { overlap: Math.min(overlap, 1), observed };
}

export function scoreCreator(
  audience: AudienceSnapshot,
  targets: ReadonlyArray<IcpTarget>,
): CreatorScore {
  const confidence = confidenceFor(audience.sampleSize, audience.postsAnalyzed);
  const grouped = targetsByDimension(targets);

  // A dimension with no ICP targets is dropped, and the rest are renormalised,
  // so an ICP that only specifies roles and geos still scores out of 100.
  const active = SCORE_DIMENSIONS.filter((d) => (grouped.get(d)?.size ?? 0) > 0);

  if (active.length === 0) {
    return { kind: "unscoreable", reason: "icp-has-no-targets", confidence };
  }

  const totalWeight = active.reduce((sum, d) => sum + DIMENSION_WEIGHTS[d], 0);

  const breakdown: DimensionBreakdown[] = active.map((dimension) => {
    const dimensionTargets = grouped.get(dimension)!;
    const { overlap, observed } = overlapFor(audience.facets, dimension, dimensionTargets);
    const weight = DIMENSION_WEIGHTS[dimension] / totalWeight;

    return {
      dimension,
      targets: [...dimensionTargets],
      overlap,
      weight,
      contribution: weight * overlap * 100,
      lost: weight * (1 - overlap) * 100,
      observed,
      detractor: detractorFor(dimension, overlap),
    };
  });

  const value = Math.round(
    breakdown.reduce((sum, entry) => sum + entry.contribution, 0),
  );

  return {
    kind: "scored",
    value,
    confidence,
    breakdown,
    largestDetractor: largestDetractorOf(breakdown),
  };
}

/**
 * The single dimension costing the most points, not the one with the worst
 * overlap. A total miss on a lightly weighted dimension matters less than a
 * partial miss on a heavy one, and the sentence above the table should name
 * whichever actually moved the number.
 *
 * Ties are common and real — industry and geo carry the same weight, so a
 * creator missing both entirely gives up exactly 25 points to each. The strict
 * comparison keeps the first in SCORE_DIMENSIONS order, which makes the choice
 * deterministic rather than dependent on how the facets happened to be loaded.
 * Either answer is true; picking the same one every time is what matters.
 */
function largestDetractorOf(
  breakdown: ReadonlyArray<DimensionBreakdown>,
): string | null {
  let worst: DimensionBreakdown | null = null;

  for (const entry of breakdown) {
    if (entry.detractor === null) continue;
    if (worst === null || entry.lost > worst.lost) worst = entry;
  }

  return worst?.detractor ?? null;
}

/**
 * The score a caller is allowed to put on screen.
 *
 * PRODUCT.md: at low confidence "the UI shows 'Not enough data' ... It does not
 * show a greyed-out number, because a number shown at all is a number that gets
 * quoted." Returning null here makes the rule the default rather than something
 * every caller has to remember. The full value stays on the score object for
 * anything that legitimately needs it, such as ordering.
 */
export function quotableValue(score: CreatorScore): number | null {
  if (score.kind === "unscoreable") return null;
  if (score.confidence === "low") return null;
  return score.value;
}

/**
 * Marketplace ordering: score descending, low confidence last (PRODUCT.md step
 * 5). Unscoreable entries sort after everything, since there is no number to
 * rank them by.
 *
 * The band is low-versus-not-low, not one band per confidence level. A `low`
 * score is one `quotableValue` refuses to print, so ranking by it would order
 * the list on numbers the UI never shows — that is what sinks it to the bottom.
 * A `medium` score *is* printed, and a number shown on a card has to be the
 * number the card is sorted by, or the ordering silently means something other
 * than what the reader sees.
 *
 * Sorting medium below high regardless of value was the earlier behaviour and
 * it is wrong on the seeded data: the best medium-confidence creator scores 68
 * and would land beneath a high-confidence 8. Confidence is already carried on
 * the card as its own label; it does not also need to outrank the score.
 */
export function compareForMarketplace(a: CreatorScore, b: CreatorScore): number {
  const aUnscoreable = a.kind === "unscoreable";
  const bUnscoreable = b.kind === "unscoreable";
  if (aUnscoreable || bUnscoreable) {
    return Number(aUnscoreable) - Number(bUnscoreable);
  }

  const byQuotability = Number(a.confidence === "low") - Number(b.confidence === "low");
  if (byQuotability !== 0) return byQuotability;

  return b.value - a.value;
}
