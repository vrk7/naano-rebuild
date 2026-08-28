import { describe, expect, it } from "vitest";

import {
  ICP_COUNT,
  buildVocabulary,
  parseBrandIntelligence,
  type BrandIntelligence,
} from "@/lib/brand/intelligence";
import type { ParseResult } from "@/lib/parse";

/**
 * Parsing a generated brand profile and its ICPs.
 *
 * "LLM response parsing" is one of the four things CLAUDE.md requires tests
 * for, and this is the one whose output is scored against for the life of the
 * workspace. An `icp_target` row holding "UK" instead of "GB" matches no
 * audience facet, ever — the score does not fail, it comes back lower and
 * confident. That is the failure PRODUCT.md opens by refusing, arriving through
 * the back door, so every value is checked against the vocabulary the score
 * joins on.
 */

const TOPICS = [
  { id: "t-industrial", slug: "industrial-equipment", label: "Industrial Equipment", kind: "industry" as const },
  { id: "t-manufacturing", slug: "manufacturing", label: "Manufacturing", kind: "industry" as const },
  { id: "t-sales", slug: "sales", label: "Sales", kind: "function" as const },
  { id: "t-engineering", slug: "engineering", label: "Engineering", kind: "function" as const },
];

const VOCABULARY = buildVocabulary(TOPICS);

const VALID = {
  profile: {
    companyName: "Atira Industrial",
    tagline: "RFQ turnaround for industrial manufacturers",
    valueProp: "Atira cuts quote turnaround from days to hours.",
    industry: "industrial-equipment",
    sizeBand: "51-200",
  },
  icps: [
    {
      label: "Sales engineering leaders, EU manufacturing",
      description: "They own quote turnaround and can authorise a pilot.",
      targets: {
        job_function: ["sales", "engineering"],
        seniority: ["manager", "director"],
        industry: ["industrial-equipment"],
        geo: ["DE", "NL"],
      },
    },
    {
      label: "Operations directors",
      description: "They own the delay downstream.",
      targets: { job_function: ["sales"], seniority: ["director"], industry: [], geo: ["DE"] },
    },
    {
      label: "Automotive tier-one engineering managers",
      description: "",
      targets: { job_function: ["engineering"], seniority: ["manager"], industry: [], geo: [] },
    },
  ],
};

function answer(mutate: (draft: Record<string, unknown>) => void): unknown {
  const draft = structuredClone(VALID) as Record<string, unknown>;
  mutate(draft);
  return draft;
}

function ok(result: ParseResult<BrandIntelligence>): BrandIntelligence {
  expect(result).toMatchObject({ kind: "ok" });
  if (result.kind !== "ok") throw new Error(result.error);
  return result.value;
}

function error(result: ParseResult<BrandIntelligence>): string {
  expect(result).toMatchObject({ kind: "invalid" });
  if (result.kind !== "invalid") throw new Error("expected a refusal");
  return result.error;
}

describe("a usable answer", () => {
  it("parses the profile and all three ICPs", () => {
    const parsed = ok(parseBrandIntelligence(VALID, VOCABULARY));

    expect(parsed.profile.companyName).toBe("Atira Industrial");
    expect(parsed.profile.industry).toBe("industrial-equipment");
    expect(parsed.icps).toHaveLength(ICP_COUNT);
    expect(parsed.icps[0].targets.geo).toEqual(["DE", "NL"]);
  });

  it("trims and de-duplicates target sets", () => {
    const parsed = ok(
      parseBrandIntelligence(
        answer((draft) => {
          (draft.icps as Array<Record<string, unknown>>)[0].targets = {
            job_function: [" sales ", "sales"],
            seniority: ["manager"],
            industry: [],
            geo: [],
          };
        }),
        VOCABULARY,
      ),
    );

    expect(parsed.icps[0].targets.job_function).toEqual(["sales"]);
  });

  /** The paragraph is read, never scored, so an empty one is a poorer ICP not a broken one. */
  it("allows an empty description and tagline", () => {
    const parsed = ok(
      parseBrandIntelligence(
        answer((draft) => {
          (draft.profile as Record<string, unknown>).tagline = "";
        }),
        VOCABULARY,
      ),
    );
    expect(parsed.profile.tagline).toBe("");
    expect(parsed.icps[2].description).toBe("");
  });

  /** An ICP that names only two dimensions still scores — the rest renormalise. */
  it("allows an ICP that fills only some dimensions", () => {
    const parsed = ok(parseBrandIntelligence(VALID, VOCABULARY));
    expect(parsed.icps[2].targets.industry).toEqual([]);
    expect(parsed.icps[2].targets.geo).toEqual([]);
  });
});

describe("values outside the vocabulary", () => {
  /**
   * The case this parser exists for. "UK" is not an ISO-3166 code, so the row
   * would join to nothing and the ICP would score as though its geos had never
   * been asked for.
   */
  it("refuses a region that is not one we record", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.icps as Array<Record<string, unknown>>)[0].targets = {
              ...(VALID.icps[0].targets as object),
              geo: ["UK"],
            };
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/"UK".*geo vocabulary/);
  });

  it("refuses a lowercased region, which would never match a facet", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.icps as Array<Record<string, unknown>>)[0].targets = {
              ...(VALID.icps[0].targets as object),
              geo: ["de"],
            };
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/"de"/);
  });

  it("refuses an industry slug we do not have", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.icps as Array<Record<string, unknown>>)[1].targets = {
              ...(VALID.icps[1].targets as object),
              industry: ["heavy-industry"],
            };
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/"heavy-industry".*industry vocabulary/);
  });

  it("refuses a job function that is not a topic", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.icps as Array<Record<string, unknown>>)[0].targets = {
              ...(VALID.icps[0].targets as object),
              job_function: ["procurement"],
            };
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/"procurement"/);
  });

  it("refuses a seniority outside the ladder", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.icps as Array<Record<string, unknown>>)[0].targets = {
              ...(VALID.icps[0].targets as object),
              seniority: ["head-of"],
            };
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/"head-of"/);
  });

  it("refuses a brand industry and a size band we do not use", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.profile as Record<string, unknown>).industry = "widgets";
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/"widgets"/);

    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.profile as Record<string, unknown>).sizeBand = "about 80";
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/"about 80"/);
  });
});

describe("shapes that are not an answer", () => {
  it("refuses anything that is not an object", () => {
    expect(error(parseBrandIntelligence("{}", VOCABULARY))).toMatch(/not an object/i);
    expect(error(parseBrandIntelligence(null, VOCABULARY))).toMatch(/not an object/i);
    expect(error(parseBrandIntelligence([VALID], VOCABULARY))).toMatch(/not an object/i);
  });

  it("refuses a missing or empty company name", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            delete (draft.profile as Record<string, unknown>).companyName;
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/company name is missing/i);

    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.profile as Record<string, unknown>).companyName = "   ";
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/company name came back empty/i);
  });

  it("refuses a value proposition longer than the field", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.profile as Record<string, unknown>).valueProp = "x".repeat(2001);
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/longer than 2000/);
  });

  /** `icp` has a unique (workspace, rank) over ranks 1..3. Two is not a set. */
  it("refuses any number of ICPs other than three", () => {
    for (const count of [0, 2, 4]) {
      expect(
        error(
          parseBrandIntelligence(
            answer((draft) => {
              const icps = draft.icps as unknown[];
              draft.icps = count <= icps.length ? icps.slice(0, count) : [...icps, icps[0]];
            }),
            VOCABULARY,
          ),
        ),
      ).toMatch(/exactly 3/);
    }
  });

  it("refuses an ICP with nothing to score against", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.icps as Array<Record<string, unknown>>)[2].targets = {
              job_function: [],
              seniority: [],
              industry: [],
              geo: [],
            };
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/no targets/i);
  });

  it("refuses targets that are not lists", () => {
    expect(
      error(
        parseBrandIntelligence(
          answer((draft) => {
            (draft.icps as Array<Record<string, unknown>>)[0].targets = {
              ...(VALID.icps[0].targets as object),
              geo: "DE",
            };
          }),
          VOCABULARY,
        ),
      ),
    ).toMatch(/other than a list/i);
  });
});
