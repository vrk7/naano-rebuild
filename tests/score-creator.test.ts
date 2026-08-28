import { describe, expect, it } from "vitest";

import {
  compareForMarketplace,
  quotableValue,
  scoreCreator,
  type AudienceSnapshot,
  type CreatorScore,
  type IcpTarget,
} from "@/lib/score/creator";
import { DIMENSION_WEIGHTS } from "@/lib/score/weights";

/**
 * The match scoring engine. PRODUCT.md calls this out by name as one of the
 * things CLAUDE.md requires tests for, and names the three cases that matter:
 * "a creator who should score low, a creator with too small a sample, an ICP
 * that targets only two dimensions".
 */

/** Sample and posts high enough to score "high" unless a test says otherwise. */
const CONFIDENT = { sampleSize: 1_000, postsAnalyzed: 50 };

function snapshot(
  facets: Array<[string, string, number]>,
  meta: Partial<Pick<AudienceSnapshot, "sampleSize" | "postsAnalyzed">> = {},
): AudienceSnapshot {
  return {
    ...CONFIDENT,
    ...meta,
    facets: facets.map(([dimension, value, share]) => ({
      dimension: dimension as AudienceSnapshot["facets"][number]["dimension"],
      value,
      share,
    })),
  };
}

function targets(pairs: Array<[string, string]>): IcpTarget[] {
  return pairs.map(([dimension, value]) => ({
    dimension: dimension as IcpTarget["dimension"],
    value,
  }));
}

function scored(result: CreatorScore) {
  if (result.kind !== "scored") throw new Error(`expected a score, got ${result.kind}`);
  return result;
}

describe("the formula", () => {
  it("is 100 x the weighted sum of per-dimension overlap", () => {
    // Every dimension entirely on target scores 100 regardless of weights.
    const audience = snapshot([
      ["job_function", "sales", 1],
      ["seniority", "director", 1],
      ["industry", "topic-a", 1],
      ["geo", "DE", 1],
    ]);
    const icp = targets([
      ["job_function", "sales"],
      ["seniority", "director"],
      ["industry", "topic-a"],
      ["geo", "DE"],
    ]);

    expect(scored(scoreCreator(audience, icp)).value).toBe(100);
  });

  it("weights each dimension as PRODUCT.md specifies", () => {
    // Only job_function is on target. Its weight is 0.30, so the score is 30.
    const audience = snapshot([
      ["job_function", "sales", 1],
      ["seniority", "ic", 1],
      ["industry", "topic-z", 1],
      ["geo", "IN", 1],
    ]);
    const icp = targets([
      ["job_function", "sales"],
      ["seniority", "director"],
      ["industry", "topic-a"],
      ["geo", "DE"],
    ]);

    expect(scored(scoreCreator(audience, icp)).value).toBe(
      Math.round(DIMENSION_WEIGHTS.job_function * 100),
    );
  });

  it("sums the shares of every facet inside the target set", () => {
    const audience = snapshot([
      ["geo", "DE", 0.3],
      ["geo", "FR", 0.2],
      ["geo", "IN", 0.5],
    ]);
    const icp = targets([
      ["geo", "DE"],
      ["geo", "FR"],
    ]);

    const result = scored(scoreCreator(audience, icp));
    // geo is the only active dimension, so it renormalises to weight 1.
    expect(result.breakdown[0].overlap).toBeCloseTo(0.5);
    expect(result.value).toBe(50);
  });

  it("keeps the breakdown reconciling with the value", () => {
    const audience = snapshot([
      ["job_function", "sales", 0.4],
      ["job_function", "marketing", 0.6],
      ["seniority", "director", 0.25],
      ["seniority", "ic", 0.75],
      ["industry", "topic-a", 0.1],
      ["industry", "topic-b", 0.9],
      ["geo", "DE", 0.7],
      ["geo", "IN", 0.3],
    ]);
    const icp = targets([
      ["job_function", "sales"],
      ["seniority", "director"],
      ["industry", "topic-a"],
      ["geo", "DE"],
    ]);

    const result = scored(scoreCreator(audience, icp));
    const summed = result.breakdown.reduce((s, b) => s + b.contribution, 0);

    expect(Math.round(summed)).toBe(result.value);
    // Contribution plus what was lost is the dimension's whole weight.
    for (const entry of result.breakdown) {
      expect(entry.contribution + entry.lost).toBeCloseTo(entry.weight * 100);
    }
  });
});

describe("an ICP that targets only two dimensions", () => {
  it("drops the untargeted dimensions and renormalises the rest", () => {
    const audience = snapshot([
      ["job_function", "sales", 1],
      ["geo", "DE", 1],
      ["seniority", "ic", 1],
      ["industry", "topic-z", 1],
    ]);
    // Roles and geos only, both fully matched. PRODUCT.md: it "still scores".
    const icp = targets([
      ["job_function", "sales"],
      ["geo", "DE"],
    ]);

    const result = scored(scoreCreator(audience, icp));

    expect(result.value).toBe(100);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(1);
  });

  it("keeps the relative weighting of the dimensions that remain", () => {
    // job_function 0.30 and geo 0.25 renormalise to 0.545 and 0.455.
    const audience = snapshot([
      ["job_function", "sales", 1],
      ["geo", "IN", 1],
    ]);
    const icp = targets([
      ["job_function", "sales"],
      ["geo", "DE"],
    ]);

    const expected =
      DIMENSION_WEIGHTS.job_function /
      (DIMENSION_WEIGHTS.job_function + DIMENSION_WEIGHTS.geo);

    expect(scored(scoreCreator(audience, icp)).value).toBe(Math.round(expected * 100));
  });

  it("refuses to score an ICP with no targets at all", () => {
    // Not zero. Zero would say the creator matches nothing you asked for, when
    // the truth is that nothing was asked for.
    const result = scoreCreator(snapshot([["geo", "DE", 1]]), []);

    expect(result.kind).toBe("unscoreable");
    expect(quotableValue(result)).toBeNull();
  });
});

describe("a creator who should score low", () => {
  it("scores in single digits against an ICP their audience misses", () => {
    // The seeded global-reach-trap shape: 43% India, 24% Pakistan, founders and
    // marketers, industries the ICP never mentions.
    const audience = snapshot([
      ["geo", "IN", 0.43],
      ["geo", "PK", 0.24],
      ["geo", "NG", 0.08],
      ["geo", "DE", 0.05],
      ["geo", "US", 0.2],
      ["job_function", "marketing", 0.38],
      ["job_function", "executive", 0.34],
      ["job_function", "sales", 0.18],
      ["job_function", "engineering", 0.1],
      ["seniority", "founder", 0.62],
      ["seniority", "ic", 0.18],
      ["seniority", "senior", 0.12],
      ["seniority", "manager", 0.08],
      ["industry", "media", 0.26],
      ["industry", "ai", 0.23],
      ["industry", "ecommerce", 0.29],
      ["industry", "saas", 0.22],
    ]);
    const icp = targets([
      ["geo", "DE"],
      ["geo", "FR"],
      ["geo", "NL"],
      ["job_function", "engineering"],
      ["job_function", "operations"],
      ["seniority", "director"],
      ["seniority", "vp"],
      ["industry", "industrial-equipment"],
      ["industry", "manufacturing"],
    ]);

    const result = scored(scoreCreator(audience, icp));

    expect(result.value).toBeLessThan(15);
    expect(result.confidence).toBe("high");
  });

  it("names the dimension costing the most points, not the worst overlap", () => {
    // industry misses completely but is weighted 0.25; job_function misses 70%
    // at weight 0.30, which costs 21 points against industry's 25... so
    // industry still leads. Flip it: make job_function a total miss too and the
    // heavier dimension must win.
    const audience = snapshot([
      ["job_function", "marketing", 1],
      ["industry", "media", 1],
    ]);
    const icp = targets([
      ["job_function", "engineering"],
      ["industry", "manufacturing"],
    ]);

    const result = scored(scoreCreator(audience, icp));

    expect(result.largestDetractor).toBe("100% of this audience is in other job functions");
  });

  it("phrases each dimension's miss in its own words", () => {
    const audience = snapshot([["geo", "IN", 0.96], ["geo", "DE", 0.04]]);
    const icp = targets([["geo", "DE"]]);

    const result = scored(scoreCreator(audience, icp));

    // The example straight out of PRODUCT.md.
    expect(result.breakdown[0].detractor).toBe(
      "96% of this audience is outside your target regions",
    );
    expect(result.breakdown[0].overlap).toBeCloseTo(0.04);
  });

  it("has no detractor when the audience is entirely on target", () => {
    const result = scored(
      scoreCreator(snapshot([["geo", "DE", 1]]), targets([["geo", "DE"]])),
    );

    expect(result.breakdown[0].detractor).toBeNull();
    expect(result.largestDetractor).toBeNull();
  });
});

describe("a creator with too small a sample", () => {
  it.each([
    [99, 50, "low"],
    [1_000, 9, "low"],
    [399, 50, "medium"],
    [1_000, 24, "medium"],
    [400, 25, "high"],
  ])("sample %i over %i posts is %s confidence", (sampleSize, postsAnalyzed, expected) => {
    const result = scoreCreator(
      snapshot([["geo", "DE", 1]], { sampleSize, postsAnalyzed }),
      targets([["geo", "DE"]]),
    );

    expect(result.confidence).toBe(expected);
  });

  it("withholds the number at low confidence however good the score", () => {
    // PRODUCT.md: "a number shown at all is a number that gets quoted".
    const result = scoreCreator(
      snapshot([["geo", "DE", 1]], { sampleSize: 40, postsAnalyzed: 4 }),
      targets([["geo", "DE"]]),
    );

    expect(scored(result).value).toBe(100);
    expect(quotableValue(result)).toBeNull();
  });

  it("still reports the value on the object for ordering", () => {
    const result = scored(
      scoreCreator(
        snapshot([["geo", "DE", 1]], { sampleSize: 40, postsAnalyzed: 4 }),
        targets([["geo", "DE"]]),
      ),
    );

    expect(result.value).toBe(100);
    expect(result.breakdown).toHaveLength(1);
  });
});

describe("marketplace ordering", () => {
  function at(value: number, confidence: "low" | "medium" | "high"): CreatorScore {
    return { kind: "scored", value, confidence, breakdown: [], largestDetractor: null };
  }

  it("sorts by score descending", () => {
    const sorted = [at(20, "high"), at(90, "high"), at(55, "high")].sort(
      compareForMarketplace,
    );
    expect(sorted.map((s) => (s.kind === "scored" ? s.value : null))).toEqual([90, 55, 20]);
  });

  it("puts low confidence last however high the number", () => {
    const sorted = [at(98, "low"), at(40, "high"), at(60, "medium")].sort(
      compareForMarketplace,
    );
    expect(sorted.map((s) => (s.kind === "scored" ? s.value : null))).toEqual([60, 40, 98]);
  });

  // The band is low-versus-not-low. A medium score is one the UI prints, so it
  // has to rank by the printed number; only the scores we refuse to show get
  // pushed to the bottom regardless of value.
  it("ranks a medium score above a lower high-confidence one", () => {
    const sorted = [at(8, "high"), at(68, "medium")].sort(compareForMarketplace);
    expect(sorted.map((s) => (s.kind === "scored" ? s.value : null))).toEqual([68, 8]);
  });

  it("puts unscoreable entries after everything", () => {
    const unscoreable: CreatorScore = {
      kind: "unscoreable",
      reason: "icp-has-no-targets",
      confidence: "high",
    };
    const sorted = [unscoreable, at(10, "low"), at(50, "high")].sort(compareForMarketplace);
    expect(sorted.map((s) => s.kind)).toEqual(["scored", "scored", "unscoreable"]);
  });
});

describe("bad input", () => {
  it("throws on a share outside 0..1 rather than scoring around it", () => {
    expect(() =>
      scoreCreator(snapshot([["geo", "DE", 1.4]]), targets([["geo", "DE"]])),
    ).toThrow(/between 0 and 1/);

    expect(() =>
      scoreCreator(snapshot([["geo", "DE", Number.NaN]]), targets([["geo", "DE"]])),
    ).toThrow(/between 0 and 1/);
  });

  it("clamps a dimension whose shares drift above 1", () => {
    // Stored to four decimal places, so a dimension summing to 1.0000 can land
    // a hair over once added as floats.
    const audience = snapshot([
      ["geo", "DE", 0.3333],
      ["geo", "FR", 0.3333],
      ["geo", "NL", 0.3334],
      ["geo", "PL", 0.0001],
    ]);
    const icp = targets([
      ["geo", "DE"],
      ["geo", "FR"],
      ["geo", "NL"],
      ["geo", "PL"],
    ]);

    const result = scored(scoreCreator(audience, icp));
    expect(result.breakdown[0].overlap).toBeLessThanOrEqual(1);
    expect(result.value).toBe(100);
  });

  it("reports a dimension with no facets as unobserved, not as a miss it measured", () => {
    const audience = snapshot([["geo", "DE", 1]]);
    const icp = targets([
      ["geo", "DE"],
      ["industry", "manufacturing"],
    ]);

    const result = scored(scoreCreator(audience, icp));
    const industry = result.breakdown.find((b) => b.dimension === "industry")!;

    expect(industry.observed).toBe(false);
    expect(industry.overlap).toBe(0);
    expect(result.breakdown.find((b) => b.dimension === "geo")!.observed).toBe(true);
  });

  it("does not mutate the inputs it is given", () => {
    const audience = snapshot([["geo", "DE", 1]]);
    const icp = targets([["geo", "DE"]]);
    const facetsBefore = JSON.stringify(audience.facets);
    const icpBefore = JSON.stringify(icp);

    scoreCreator(audience, icp);

    expect(JSON.stringify(audience.facets)).toBe(facetsBefore);
    expect(JSON.stringify(icp)).toBe(icpBefore);
  });
});
