import { describe, expect, it } from "vitest";

import { campaignReach, reachesCampaign } from "@/lib/campaign/reach";
import type { AudienceFacet } from "@/lib/score/creator";

/**
 * Scoping the marketplace to a campaign.
 *
 * This decides which creators a brand is shown, so it is access-adjacent in the
 * way the score is: a rule that silently drops the wrong rows is the same
 * failure as a score that only ever comes back high.
 */

function facets(entries: ReadonlyArray<readonly [string, string, number]>): AudienceFacet[] {
  return entries.map(([dimension, value, share]) => ({
    dimension: dimension as AudienceFacet["dimension"],
    value,
    share,
  }));
}

const EU = ["DE", "NL", "SE"];

describe("measuring reach", () => {
  it("sums the shares inside the campaign's regions", () => {
    const reach = campaignReach(
      facets([
        ["geo", "DE", 0.4],
        ["geo", "NL", 0.25],
        ["geo", "US", 0.35],
      ]),
      EU,
    );

    expect(reach).toEqual({ kind: "measured", share: 0.65 });
  });

  it("ignores facets from other dimensions", () => {
    const reach = campaignReach(
      facets([
        ["geo", "DE", 0.5],
        ["industry", "DE", 0.5],
        ["job_function", "NL", 0.5],
      ]),
      EU,
    );

    expect(reach).toEqual({ kind: "measured", share: 0.5 });
  });

  // The seeded trap: 410k followers, an audience in IN/PK/NG, and a European
  // campaign it reaches not at all.
  it("reports zero rather than rounding it away", () => {
    const reach = campaignReach(
      facets([
        ["geo", "IN", 0.43],
        ["geo", "PK", 0.29],
        ["geo", "NG", 0.28],
      ]),
      EU,
    );

    expect(reach).toEqual({ kind: "measured", share: 0 });
  });

  // Shares are stored to four decimal places and can sum a hair over 1.0 as
  // floats, the same reason the scoring engine clamps its overlap.
  it("clamps a full audience to 1", () => {
    const reach = campaignReach(
      facets([
        ["geo", "DE", 0.3334],
        ["geo", "NL", 0.3333],
        ["geo", "SE", 0.3333],
      ]),
      EU,
    );

    expect(reach.kind === "measured" && reach.share).toBeLessThanOrEqual(1);
  });
});

describe("the questions that were not asked", () => {
  /**
   * A campaign with no regions is not a campaign that reaches nowhere. Reporting
   * zero would make the filter exclude everyone.
   */
  it("says untargeted when the campaign names no regions", () => {
    expect(campaignReach(facets([["geo", "DE", 1]]), [])).toEqual({ kind: "untargeted" });
  });

  /**
   * The same distinction the score breakdown draws between "not observed" and a
   * zero overlap: no data is a gap in what we know, not a fact about the
   * audience.
   */
  it("says unobserved when the snapshot carries no geo facets", () => {
    expect(campaignReach(facets([["industry", "saas", 1]]), EU)).toEqual({
      kind: "unobserved",
    });
    expect(campaignReach([], EU)).toEqual({ kind: "unobserved" });
  });
});

describe("the filter", () => {
  // "None at all" is a fact. Any other cut-off would be a number invented to
  // make the filter feel decisive.
  it("excludes only a measured zero", () => {
    expect(reachesCampaign({ kind: "measured", share: 0 })).toBe(false);
    expect(reachesCampaign({ kind: "measured", share: 0.0001 })).toBe(true);
  });

  it("keeps creators whose reach was never established", () => {
    expect(reachesCampaign({ kind: "untargeted" })).toBe(true);
    expect(reachesCampaign({ kind: "unobserved" })).toBe(true);
  });
});
