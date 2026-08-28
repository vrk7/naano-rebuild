import { describe, expect, it } from "vitest";

import {
  bestIcpScore,
  paginate,
  scoreBand,
  sortCreators,
  type IcpScore,
  type RankedCreator,
} from "@/lib/marketplace/ranking";
import type { CreatorScore } from "@/lib/score/creator";

/**
 * Marketplace ordering and ICP selection.
 *
 * Under CLAUDE.md's four testable things this is scoring math: it decides which
 * number reaches a card and in what order the cards come, and getting it wrong
 * reproduces the failure the whole build exists to correct — a list where the
 * ranking has nothing to do with the score shown on it.
 */

function score(value: number, confidence: "low" | "medium" | "high" = "high"): CreatorScore {
  return { kind: "scored", value, confidence, breakdown: [], largestDetractor: null };
}

const UNSCOREABLE: CreatorScore = {
  kind: "unscoreable",
  reason: "icp-has-no-targets",
  confidence: "high",
};

function icpScore(rank: number, value: CreatorScore): IcpScore {
  return { icp: { id: `icp-${rank}`, label: `ICP ${rank}`, rank }, score: value };
}

function creator(
  name: string,
  followers: number,
  scores: ReadonlyArray<IcpScore>,
): RankedCreator {
  return {
    creator: {
      id: name,
      displayName: name,
      headline: null,
      country: null,
      followers,
      priceCents: null,
      currency: null,
      topics: [],
      sampleSize: 500,
      postsAnalyzed: 30,
    },
    scores,
    best: bestIcpScore(scores),
  };
}

describe("choosing the ICP a card speaks for", () => {
  it("takes the highest-scoring ICP", () => {
    const best = bestIcpScore([
      icpScore(1, score(31)),
      icpScore(2, score(74)),
      icpScore(3, score(12)),
    ]);

    expect(best.icp.rank).toBe(2);
  });

  // Rank is the brand's own statement of which segment matters most, so a tie
  // resolves to it rather than to whichever row loaded first.
  it("breaks ties towards the lower rank", () => {
    const best = bestIcpScore([icpScore(3, score(60)), icpScore(1, score(60))]);
    expect(best.icp.rank).toBe(1);
  });

  it("prefers a quotable score over a higher unquotable one", () => {
    const best = bestIcpScore([
      icpScore(1, score(90, "low")),
      icpScore(2, score(35, "high")),
    ]);

    expect(best.icp.rank).toBe(2);
  });

  it("falls back to an unscoreable ICP only when nothing else scores", () => {
    const best = bestIcpScore([icpScore(1, UNSCOREABLE), icpScore(2, UNSCOREABLE)]);
    expect(best.icp.rank).toBe(1);
  });

  it("refuses an empty ICP list rather than inventing a match", () => {
    expect(() => bestIcpScore([])).toThrow(/at least one/);
  });
});

describe("marketplace ordering", () => {
  const strong = creator("Strong", 10_000, [icpScore(1, score(79))]);
  const weak = creator("Weak", 400_000, [icpScore(1, score(10))]);
  const thin = creator("Thin", 3_000, [icpScore(1, score(88, "low"))]);

  it("sorts by match with low confidence last", () => {
    const sorted = sortCreators([thin, weak, strong], "match");
    expect(sorted.map((entry) => entry.creator.displayName)).toEqual([
      "Strong",
      "Weak",
      "Thin",
    ]);
  });

  /**
   * The reason the followers sort exists. It is the ranking a marketplace
   * without a score effectively ships, and it has to put the 400k-follower
   * creator scoring 10 first — that contrast is the argument.
   */
  it("sorts by followers without touching the scores", () => {
    const sorted = sortCreators([strong, weak, thin], "followers");
    expect(sorted.map((entry) => entry.creator.displayName)).toEqual([
      "Weak",
      "Strong",
      "Thin",
    ]);
  });

  it("breaks ties on name so the list does not reshuffle between renders", () => {
    const b = creator("Bravo", 5_000, [icpScore(1, score(50))]);
    const a = creator("Alpha", 5_000, [icpScore(1, score(50))]);

    expect(sortCreators([b, a], "match").map((e) => e.creator.displayName)).toEqual([
      "Alpha",
      "Bravo",
    ]);
    expect(sortCreators([b, a], "followers").map((e) => e.creator.displayName)).toEqual([
      "Alpha",
      "Bravo",
    ]);
  });
});

describe("paging", () => {
  const items = Array.from({ length: 50 }, (_, i) => i);

  it("slices the requested page", () => {
    const page = paginate(items, 2, 20);
    expect(page.items).toEqual(items.slice(20, 40));
    expect(page).toMatchObject({ page: 2, pageCount: 3, total: 50 });
  });

  // An out-of-range page rendering empty would read as "no creators match" when
  // the truth is "you asked for a page that is not there".
  it("clamps a page past the end to the last one", () => {
    expect(paginate(items, 99, 20).page).toBe(3);
    expect(paginate(items, 0, 20).page).toBe(1);
    expect(paginate(items, Number.NaN, 20).page).toBe(1);
  });

  it("reports one page for an empty list", () => {
    expect(paginate([], 1, 20)).toMatchObject({ page: 1, pageCount: 1, total: 0 });
  });
});

describe("score bands", () => {
  it("withholds only what quotableValue refuses to print", () => {
    expect(scoreBand(score(88, "low"))).toBe("withheld");
    expect(scoreBand(UNSCOREABLE)).toBe("withheld");
  });

  // A weak score is shown and labelled, never hidden: a marketplace that only
  // renders scores it likes is the constant this product replaces.
  it("bands a low score rather than hiding it", () => {
    expect(scoreBand(score(10))).toBe("weak");
    expect(scoreBand(score(50))).toBe("partial");
    expect(scoreBand(score(79))).toBe("strong");
  });
});
