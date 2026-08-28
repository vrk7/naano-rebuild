import { describe, expect, it } from "vitest";

import { parseCampaignForm, parseGeos } from "@/lib/campaign/parse";
import {
  describeRequirements,
  isVacuous,
  parseRequirementsForm,
  parseStoredRequirements,
  type BriefRequirements,
} from "@/lib/campaign/requirements";
import type { ParseResult } from "@/lib/parse";

/**
 * The brief, both modes.
 *
 * `brief.requirements` is the one piece of a campaign that later becomes a
 * pass/fail judgement on somebody's writing, so what goes into it and what
 * comes back out of it are both tested. A requirement that appears from a
 * malformed row, or survives a switch to creative freedom, would fail a draft
 * for a rule nobody set.
 */

function ok<T>(result: ParseResult<T>): T {
  expect(result).toMatchObject({ kind: "ok" });
  if (result.kind !== "ok") throw new Error(result.error);
  return result.value;
}

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  }
  return data;
}

const SPECIFIC = {
  name: "EU manufacturing — RFQ turnaround",
  objective: "Put quote turnaround on the agenda.",
  mode: "specific",
  body: "Talk about what a slow quote actually costs.",
};

describe("creative freedom", () => {
  it("takes one line of body and stores no requirements", () => {
    const campaign = ok(
      parseCampaignForm(
        form({ name: "Supply chain point of view", mode: "creative_freedom", body: "Your take." }),
      ),
    );

    expect(campaign.brief).toEqual({
      mode: "creative_freedom",
      body: "Your take.",
      requirements: {},
    });
    expect(isVacuous(campaign.brief.requirements)).toBe(true);
  });

  /**
   * The form hides the requirements fields in this mode, but hidden is not
   * absent — a value left behind by switching modes must not become a rule the
   * creator is judged against.
   */
  it("ignores requirements fields left over from the other mode", () => {
    const campaign = ok(
      parseCampaignForm(
        form({
          name: "Loose brief",
          mode: "creative_freedom",
          body: "However you want to tell it.",
          mustMention: "Atira",
          mustIncludeLink: "on",
          lengthMin: "400",
          requiresDisclosure: "on",
        }),
      ),
    );

    expect(campaign.brief.requirements).toEqual({});
  });

  it("still requires the one line", () => {
    expect(
      parseCampaignForm(form({ name: "Nameless", mode: "creative_freedom", body: "   " })).kind,
    ).toBe("invalid");
  });
});

describe("specific brief requirements", () => {
  it("builds the shape PRODUCT.md specifies", () => {
    const campaign = ok(
      parseCampaignForm(
        form({
          ...SPECIFIC,
          geos: ["DE", "NL"],
          mustMention: "Atira\nRFQ turnaround",
          mustIncludeLink: "on",
          bannedClaims: "guaranteed\nfastest in the world",
          lengthMin: "400",
          lengthMax: "1800",
          requiresDisclosure: "on",
        }),
      ),
    );

    expect(campaign.brief.requirements).toEqual({
      must_mention: ["Atira", "RFQ turnaround"],
      must_include_link: true,
      banned_claims: ["guaranteed", "fastest in the world"],
      length: { min: 400, max: 1800 },
      requires_disclosure: true,
    });
    expect(campaign.geos).toEqual(["DE", "NL"]);
  });

  /**
   * Opening the specific form and requiring nothing is a real choice —
   * PRODUCT.md says the fix for naano's dead end "is not a fix by ceremony" —
   * so it parses rather than failing.
   */
  it("allows a specific brief with nothing required", () => {
    const campaign = ok(parseCampaignForm(form(SPECIFIC)));
    expect(campaign.brief.mode).toBe("specific");
    expect(isVacuous(campaign.brief.requirements)).toBe(true);
  });

  it("omits absent fields rather than storing empty ones", () => {
    const requirements = ok(parseRequirementsForm(form({ mustMention: "  \n \n" })));
    expect(requirements).toEqual({});
    expect("must_mention" in requirements).toBe(false);
  });

  // Lines, not commas: "RFQ turnaround, end to end" is one mention.
  it("splits phrases on lines and drops duplicates", () => {
    expect(ok(parseRequirementsForm(form({ mustMention: "Atira\n Atira \nRFQ, end to end" })))).toEqual(
      { must_mention: ["Atira", "RFQ, end to end"] },
    );
  });

  it("accepts a one-sided length band", () => {
    expect(ok(parseRequirementsForm(form({ lengthMin: "400" })))).toEqual({
      length: { min: 400 },
    });
    expect(ok(parseRequirementsForm(form({ lengthMax: "1800" })))).toEqual({
      length: { max: 1800 },
    });
  });

  it("rejects a band no draft could satisfy", () => {
    const result = parseRequirementsForm(form({ lengthMin: "900", lengthMax: "400" }));
    expect(result).toMatchObject({ kind: "invalid" });
  });

  // LinkedIn will not accept a longer post, so the rule could never be met.
  it("rejects a maximum above LinkedIn's own limit", () => {
    expect(parseRequirementsForm(form({ lengthMax: "5000" })).kind).toBe("invalid");
    expect(parseRequirementsForm(form({ lengthMax: "3000" })).kind).toBe("ok");
  });

  it("rejects a phrase too long to cite as evidence", () => {
    expect(parseRequirementsForm(form({ bannedClaims: "x".repeat(201) })).kind).toBe("invalid");
  });

  it.each(["-1", "12.5", "four hundred"])("rejects %j as a length", (value) => {
    expect(parseRequirementsForm(form({ lengthMin: value })).kind).toBe("invalid");
  });
});

describe("reading requirements back out of jsonb", () => {
  it("round-trips what the form wrote", () => {
    const written = ok(
      parseRequirementsForm(
        form({ mustMention: "Atira", lengthMin: "400", lengthMax: "1800", mustIncludeLink: "on" }),
      ),
    );

    expect(parseStoredRequirements(JSON.parse(JSON.stringify(written)))).toEqual(written);
  });

  it.each([null, undefined, 42, "requirements", [], {}])(
    "treats %j as no requirements",
    (value) => {
      expect(parseStoredRequirements(value)).toEqual({});
    },
  );

  /**
   * The column is jsonb, so it returns whatever was put in it. Dropping what we
   * do not recognise is the safe direction: the failure to avoid is inventing a
   * rule a creator is then judged against.
   */
  it("drops malformed entries instead of rendering them", () => {
    const stored = {
      must_mention: ["Atira", 42, "", null],
      must_include_link: "yes",
      banned_claims: "guaranteed",
      length: { min: "400", max: 1800 },
      requires_disclosure: true,
      something_else: { nested: true },
    };

    expect(parseStoredRequirements(stored)).toEqual({
      must_mention: ["Atira"],
      length: { max: 1800 },
      requires_disclosure: true,
    });
  });

  it("drops a stored band that cannot be satisfied", () => {
    expect(parseStoredRequirements({ length: { min: 900, max: 400 } })).toEqual({});
  });
});

describe("describing a brief", () => {
  it("reads as sentences a creator can act on", () => {
    const requirements: BriefRequirements = {
      must_mention: ["Atira"],
      must_include_link: true,
      banned_claims: ["guaranteed"],
      length: { min: 400, max: 1800 },
      requires_disclosure: true,
    };

    expect(describeRequirements(requirements).map((line) => `${line.label}: ${line.detail}`)).toEqual([
      "Must mention: “Atira”",
      "Must include: the tracked link",
      "Must not claim: “guaranteed”",
      "Length: between 400 and 1800 characters",
      "Must carry: a paid-partnership disclosure",
    ]);
  });

  it("says nothing when nothing is required", () => {
    expect(describeRequirements({})).toEqual([]);
  });

  it("phrases a one-sided band correctly", () => {
    expect(describeRequirements({ length: { min: 400 } })[0].detail).toBe("at least 400 characters");
    expect(describeRequirements({ length: { max: 1800 } })[0].detail).toBe("at most 1800 characters");
  });
});

describe("campaign fields", () => {
  it("keeps an empty geo list, which means no restriction", () => {
    expect(ok(parseGeos([]))).toEqual([]);
  });

  // campaign.geos is text[] with no constraint behind it, so a typo would store
  // a code no audience is ever recorded against.
  it("rejects a region outside the shared list", () => {
    expect(parseGeos(["DE", "XX"]).kind).toBe("invalid");
  });

  it("drops a repeated region", () => {
    expect(ok(parseGeos(["DE", "DE", "NL"]))).toEqual(["DE", "NL"]);
  });

  it("requires a name and treats a blank objective as absent", () => {
    expect(parseCampaignForm(form({ ...SPECIFIC, name: "  " })).kind).toBe("invalid");
    expect(ok(parseCampaignForm(form({ ...SPECIFIC, objective: "   " }))).objective).toBeNull();
  });

  it("refuses a mode it does not have", () => {
    expect(parseCampaignForm(form({ ...SPECIFIC, mode: "whatever" })).kind).toBe("invalid");
  });
});
