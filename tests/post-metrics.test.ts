import { describe, expect, it } from "vitest";

import {
  bestScore,
  formatCents,
  formatPercent,
  isMatched,
  postEconomics,
  rollUpCompanies,
  sortByRelevance,
  type EngagedPerson,
} from "@/lib/posts/metrics";
import { ICP_MATCH_THRESHOLD } from "@/lib/score/weights";

/**
 * Budget math for the post page, one of the four things CLAUDE.md requires
 * tests for. The case that matters most is a post with reach and no matches,
 * because that is the row the product exists to make legible.
 */

function person(overrides: Partial<EngagedPerson> = {}): EngagedPerson {
  return {
    id: "p1",
    fullName: "Test Person",
    roleTitle: "Director of Sales",
    seniority: "director",
    companyId: "c1",
    companyName: "Acme",
    companyCountry: "DE",
    matches: [],
    engagementKinds: ["reaction"],
    ...overrides,
  };
}

function matchedPerson(score: number, overrides: Partial<EngagedPerson> = {}) {
  return person({
    matches: [{ icpId: "i1", icpLabel: "ICP one", icpRank: 1, score }],
    ...overrides,
  });
}

describe("matching", () => {
  it("counts a person at the threshold as matched", () => {
    expect(isMatched(matchedPerson(ICP_MATCH_THRESHOLD))).toBe(true);
    expect(isMatched(matchedPerson(ICP_MATCH_THRESHOLD - 1))).toBe(false);
  });

  it("scores a person with no matches at zero rather than failing", () => {
    expect(bestScore(person())).toBe(0);
    expect(isMatched(person())).toBe(false);
  });

  it("uses the best ICP when a person matches several", () => {
    const p = person({
      matches: [
        { icpId: "i2", icpLabel: "Two", icpRank: 2, score: 90 },
        { icpId: "i1", icpLabel: "One", icpRank: 1, score: 40 },
      ],
    });
    expect(bestScore(p)).toBe(90);
  });
});

describe("post economics", () => {
  it("divides cost across engaged and matched people", () => {
    const people = [matchedPerson(80), matchedPerson(70), matchedPerson(10)];
    const result = postEconomics(30_000, people);

    expect(result.engagedPeople).toBe(3);
    expect(result.matchedPeople).toBe(2);
    expect(result.costPerEngagedCents).toBe(10_000);
    expect(result.costPerMatchedCents).toBe(15_000);
    expect(result.matchRate).toBeCloseTo(2 / 3);
  });

  it("reports no cost per matched person when a post matched nobody", () => {
    // The seeded 376k-follower post. It has the best cost per engaged person of
    // any post and produced nothing this brand asked for; reporting zero here
    // would read as free, which is the opposite of what happened.
    const people = Array.from({ length: 251 }, () => matchedPerson(11));
    const result = postEconomics(77_900, people);

    expect(result.engagedPeople).toBe(251);
    expect(result.matchedPeople).toBe(0);
    expect(result.costPerEngagedCents).toBe(310);
    expect(result.costPerMatchedCents).toBeNull();
    expect(result.matchRate).toBe(0);
  });

  it("reports nothing rather than dividing by zero on a post with no engagement", () => {
    const result = postEconomics(50_000, []);

    expect(result.costPerEngagedCents).toBeNull();
    expect(result.costPerMatchedCents).toBeNull();
    expect(result.matchRate).toBeNull();
  });

  it("stays in integer cents", () => {
    // 1000 / 3 is not a whole cent; the result must not carry a fraction.
    const result = postEconomics(1_000, [matchedPerson(80), matchedPerson(80), matchedPerson(80)]);
    expect(Number.isInteger(result.costPerMatchedCents)).toBe(true);
    expect(result.costPerMatchedCents).toBe(333);
  });
});

describe("company rollup", () => {
  it("groups people by employer and counts matches", () => {
    const people = [
      matchedPerson(80, { id: "a", companyId: "c1", companyName: "Acme" }),
      matchedPerson(20, { id: "b", companyId: "c1", companyName: "Acme" }),
      matchedPerson(90, { id: "c", companyId: "c2", companyName: "Beta" }),
    ];

    expect(rollUpCompanies(people)).toEqual([
      { id: "c1", name: "Acme", country: "DE", engaged: 2, matched: 1 },
      { id: "c2", name: "Beta", country: "DE", engaged: 1, matched: 1 },
    ]);
  });

  it("puts the most matched employer first, not the busiest", () => {
    const people = [
      ...Array.from({ length: 5 }, (_, i) =>
        matchedPerson(10, { id: `loud${i}`, companyId: "loud", companyName: "Loud" }),
      ),
      matchedPerson(90, { id: "buyer", companyId: "buyer", companyName: "Buyer" }),
    ];

    expect(rollUpCompanies(people).map((c) => c.name)).toEqual(["Buyer", "Loud"]);
  });

  it("drops people with no resolved company rather than inventing one", () => {
    const people = [
      matchedPerson(80, { id: "a" }),
      matchedPerson(80, { id: "b", companyId: null, companyName: null }),
    ];

    const rolled = rollUpCompanies(people);
    expect(rolled).toHaveLength(1);
    expect(rolled[0].engaged).toBe(1);
  });
});

describe("ordering and formatting", () => {
  it("sorts people by best score, then name", () => {
    const people = [
      matchedPerson(40, { id: "a", fullName: "Zoe" }),
      matchedPerson(90, { id: "b", fullName: "Bob" }),
      matchedPerson(40, { id: "c", fullName: "Ann" }),
    ];

    expect(sortByRelevance(people).map((p) => p.fullName)).toEqual(["Bob", "Ann", "Zoe"]);
  });

  it("does not mutate the array it is given", () => {
    const people = [matchedPerson(10, { id: "a" }), matchedPerson(90, { id: "b" })];
    const before = people.map((p) => p.id);
    sortByRelevance(people);
    expect(people.map((p) => p.id)).toEqual(before);
  });

  it("formats money and shows an em dash for nothing", () => {
    expect(formatCents(310)).toBe("$3.10");
    expect(formatCents(228_400)).toBe("$2,284");
    expect(formatCents(null)).toBe("—");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(null)).toBe("—");
  });
});
