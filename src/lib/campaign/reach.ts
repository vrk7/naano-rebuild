/**
 * How much of a creator's audience sits inside a campaign's regions.
 *
 * This is deliberately *not* the geo term of the match score, and the two can
 * disagree. `icp_target` says who the brand sells to; `campaign.geos` says where
 * this particular campaign is being run. A brand that sells across the EU can
 * run a campaign in Germany alone, and a creator can be a strong ICP match while
 * reaching almost nobody where the campaign is pointed.
 *
 * Pure, so the scoping rule is testable without a database — same reasoning as
 * the scoring engine it sits beside.
 */

import type { AudienceFacet } from "@/lib/score/creator";

export type CampaignReach =
  | {
      /**
       * The campaign names no regions, so nothing is out of area. Not zero
       * reach and not full reach — the question was not asked.
       */
      readonly kind: "untargeted";
    }
  | {
      /** The snapshot carries no geo facets at all, so reach is unknown. */
      readonly kind: "unobserved";
    }
  | {
      readonly kind: "measured";
      /** Share of the observed audience inside the campaign's regions, 0..1. */
      readonly share: number;
    };

/**
 * Sums the audience shares falling inside the campaign's regions.
 *
 * Clamped for the same reason `overlapFor` in the scoring engine is: facet
 * shares are stored to four decimal places and a dimension summing to 1.0000
 * can land a hair above it once added as floats.
 */
export function campaignReach(
  facets: ReadonlyArray<AudienceFacet>,
  geos: ReadonlyArray<string>,
): CampaignReach {
  if (geos.length === 0) return { kind: "untargeted" };

  const targets = new Set(geos);
  let share = 0;
  let observed = false;

  for (const facet of facets) {
    if (facet.dimension !== "geo") continue;
    observed = true;
    if (targets.has(facet.value)) share += facet.share;
  }

  if (!observed) return { kind: "unobserved" };

  return { kind: "measured", share: Math.min(share, 1) };
}

/**
 * Whether a creator reaches the campaign's regions at all.
 *
 * The test is "none at all", which is a fact rather than a threshold. Anything
 * else — "at least 20% in region" — would be a number invented to make a filter
 * feel decisive, and this codebase already carries enough of those.
 *
 * `untargeted` and `unobserved` both count as in scope. A campaign that names no
 * regions excludes nobody, and an audience we have no geo data for is a gap in
 * what we know rather than evidence of absence — the same distinction the score
 * breakdown draws between "not observed" and a zero overlap.
 */
export function reachesCampaign(reach: CampaignReach): boolean {
  return reach.kind !== "measured" || reach.share > 0;
}
