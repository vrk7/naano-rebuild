/**
 * The creator's stored audience, reshaped for the engagement sampler.
 *
 * `audience_facet` holds one row per (dimension, value) with a share; the
 * sampler wants those grouped per dimension. This is the join between what the
 * score reads and what the simulation draws from, and it exists so both are
 * provably looking at the same numbers — SCOPE.md: "the simulation is only
 * plausible if it is downstream of the same data the score reads."
 */

import { SCORE_DIMENSIONS, type ScoreDimension } from "@/lib/score/weights";
import type { AudienceDistribution } from "@/lib/seed/engagement";
import type { Share } from "@/lib/seed/random";

export type StoredFacet = {
  readonly dimension: string;
  readonly value: string;
  readonly share: number;
};

export type DistributionResult =
  | { readonly kind: "ok"; readonly distribution: AudienceDistribution }
  /**
   * At least one dimension has no facets at all. The sampler needs a value in
   * every dimension to place a person at a company, and there is nothing
   * honest to draw from — so this refuses rather than inventing a bucket. The
   * same distinction the score makes between "not observed" and "zero overlap".
   */
  | { readonly kind: "incomplete"; readonly missing: ReadonlyArray<ScoreDimension> };

/**
 * Shares are stored as numeric(5,4) per row and only sum to 1 across a whole
 * dimension, so rounding leaves them at 0.9998 or 1.0001. The sampler walks a
 * cumulative total and falls through to the last entry, which hides an
 * undershoot but skews the final value's odds — renormalising makes each draw
 * exactly proportional to the stored share.
 */
function normalise(shares: ReadonlyArray<Share>): ReadonlyArray<Share> {
  const total = shares.reduce((sum, entry) => sum + entry.share, 0);
  if (total <= 0) return shares;
  return shares.map((entry) => ({ value: entry.value, share: entry.share / total }));
}

export function distributionFromFacets(
  facets: ReadonlyArray<StoredFacet>,
): DistributionResult {
  const byDimension = new Map<ScoreDimension, Share[]>();
  for (const dimension of SCORE_DIMENSIONS) byDimension.set(dimension, []);

  for (const facet of facets) {
    const bucket = byDimension.get(facet.dimension as ScoreDimension);
    // A dimension the score does not read is ignored rather than rejected;
    // audience_facet is free to carry more than the four scored dimensions.
    if (!bucket) continue;
    // A zero share can be stored but can never be drawn, and leaving it in
    // only lengthens the walk.
    if (facet.share > 0) bucket.push({ value: facet.value, share: facet.share });
  }

  const missing = SCORE_DIMENSIONS.filter(
    (dimension) => byDimension.get(dimension)!.length === 0,
  );
  if (missing.length > 0) return { kind: "incomplete", missing };

  return {
    kind: "ok",
    distribution: {
      job_function: normalise(byDimension.get("job_function")!),
      seniority: normalise(byDimension.get("seniority")!),
      industry: normalise(byDimension.get("industry")!),
      geo: normalise(byDimension.get("geo")!),
    },
  };
}
