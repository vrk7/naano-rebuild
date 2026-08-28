import { describe, expect, it } from "vitest";

import {
  distributionFromFacets,
  type StoredFacet,
} from "@/lib/posts/audience-distribution";
import { SCORE_DIMENSIONS } from "@/lib/score/weights";

/**
 * The join between what the score reads and what the engagement simulation
 * draws from (PRODUCT.md step 12).
 *
 * SCOPE.md's claim is that a creator whose audience is 43% India produces
 * engagers who are ~43% India "without anything being rigged to make the
 * point". That only holds if the stored shares survive this mapping intact, so
 * that is what these check — plus the refusal, which is the case where the
 * simulation must decline rather than invent a bucket.
 */

function facet(dimension: string, value: string, share: number): StoredFacet {
  return { dimension, value, share };
}

/** A minimal complete snapshot: every scored dimension has at least one value. */
function complete(extra: ReadonlyArray<StoredFacet> = []): StoredFacet[] {
  return [
    facet("job_function", "sales", 1),
    facet("seniority", "director", 1),
    facet("industry", "topic-industrial", 1),
    facet("geo", "DE", 1),
    ...extra,
  ];
}

describe("distributionFromFacets", () => {
  it("groups stored facets under the dimension they belong to", () => {
    const result = distributionFromFacets(complete());

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.distribution.geo).toEqual([{ value: "DE", share: 1 }]);
    expect(result.distribution.industry).toEqual([
      { value: "topic-industrial", share: 1 },
    ]);
  });

  it("preserves the proportions the score reads", () => {
    const result = distributionFromFacets([
      facet("geo", "IN", 0.43),
      facet("geo", "PK", 0.24),
      facet("geo", "DE", 0.33),
      facet("job_function", "sales", 1),
      facet("seniority", "director", 1),
      facet("industry", "topic-industrial", 1),
    ]);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const india = result.distribution.geo.find((entry) => entry.value === "IN");
    expect(india?.share).toBeCloseTo(0.43, 5);
  });

  it("renormalises shares that do not quite sum to one", () => {
    // numeric(5,4) per row means a dimension can be stored at 0.9998.
    const result = distributionFromFacets([
      facet("geo", "IN", 0.4299),
      facet("geo", "DE", 0.5699),
      facet("job_function", "sales", 1),
      facet("seniority", "director", 1),
      facet("industry", "topic-industrial", 1),
    ]);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const total = result.distribution.geo.reduce((sum, entry) => sum + entry.share, 0);
    expect(total).toBeCloseTo(1, 10);
    // Renormalising must not reorder or reweight relative to one another.
    expect(result.distribution.geo[0].value).toBe("IN");
    expect(result.distribution.geo[0].share).toBeLessThan(
      result.distribution.geo[1].share,
    );
  });

  it("drops zero shares, which can be stored but never drawn", () => {
    const result = distributionFromFacets([
      facet("geo", "DE", 1),
      facet("geo", "FR", 0),
      facet("job_function", "sales", 1),
      facet("seniority", "director", 1),
      facet("industry", "topic-industrial", 1),
    ]);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.distribution.geo).toEqual([{ value: "DE", share: 1 }]);
  });

  it("ignores dimensions the score does not read", () => {
    const result = distributionFromFacets(complete([facet("company_size", "51-200", 1)]));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(Object.keys(result.distribution).sort()).toEqual([...SCORE_DIMENSIONS].sort());
  });

  it.each(SCORE_DIMENSIONS)(
    "refuses rather than inventing a bucket when %s is unobserved",
    (missing) => {
      const facets = complete().filter((entry) => entry.dimension !== missing);
      const result = distributionFromFacets(facets);

      expect(result.kind).toBe("incomplete");
      if (result.kind !== "incomplete") return;
      expect(result.missing).toEqual([missing]);
    },
  );

  it("names every unobserved dimension, not just the first", () => {
    const result = distributionFromFacets([
      facet("job_function", "sales", 1),
      facet("seniority", "director", 1),
    ]);

    expect(result.kind).toBe("incomplete");
    if (result.kind !== "incomplete") return;
    expect([...result.missing].sort()).toEqual(["geo", "industry"]);
  });

  it("treats an empty snapshot as every dimension missing", () => {
    const result = distributionFromFacets([]);

    expect(result.kind).toBe("incomplete");
    if (result.kind !== "incomplete") return;
    expect(result.missing).toHaveLength(SCORE_DIMENSIONS.length);
  });
});
