import { describe, expect, it } from "vitest";

import {
  displayNameFromSlug,
  parseCreatorListing,
  parseLinkedinUrl,
  parsePriceCents,
  parseTopicIds,
  type ParseResult,
} from "@/lib/auth/creator-signup";

/**
 * Creator signup parsing.
 *
 * This is the only place untrusted input from a public page becomes rows in
 * `creator`, `creator_topic` and `creator_rate`. Everything it lets through is
 * something the marketplace then renders and the booking flow charges against,
 * so it is tested for what it rejects as much as for what it accepts.
 */

const TOPIC_A = "11111111-2222-4333-8444-555555555555";
const TOPIC_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TOPIC_C = "99999999-8888-4777-8666-555555555555";

/** Asserts the parse succeeded and narrows to the parsed value. */
function ok<T>(result: ParseResult<T>): T {
  expect(result).toMatchObject({ kind: "ok" });
  if (result.kind !== "ok") throw new Error(result.error);
  return result.value;
}

describe("linkedin profile url", () => {
  // linkedin_url is unique, so two spellings of one profile have to collapse or
  // the constraint stops meaning anything.
  it.each([
    "https://www.linkedin.com/in/mateo-jansen",
    "https://linkedin.com/in/mateo-jansen/",
    "linkedin.com/in/mateo-jansen",
    "http://de.linkedin.com/in/Mateo-Jansen",
    "https://www.linkedin.com/in/mateo-jansen/?trk=nav_profile",
  ])("normalises %s", (input) => {
    expect(ok<string>(parseLinkedinUrl(input))).toBe(
      "https://www.linkedin.com/in/mateo-jansen",
    );
  });

  it.each([
    ["", "an empty field"],
    ["not a url at all ", "prose"],
    ["https://example.com/in/mateo", "another host"],
    ["https://www.linkedin.com/company/atira", "a company page"],
    ["https://www.linkedin.com/feed/", "a feed url"],
    ["https://www.linkedin.com/in/a/b", "a deeper path"],
  ])("rejects %j — %s", (input) => {
    expect(parseLinkedinUrl(input).kind).toBe("invalid");
  });

  it("rejects a non-string, which is what a missing field gives", () => {
    expect(parseLinkedinUrl(null).kind).toBe("invalid");
  });
});

describe("display name derived from the slug", () => {
  it("title-cases the name parts", () => {
    expect(displayNameFromSlug("https://www.linkedin.com/in/mateo-jansen")).toBe(
      "Mateo Jansen",
    );
  });

  // Vanity URLs usually carry a disambiguating id that is not part of a name.
  it("drops a trailing id segment", () => {
    expect(displayNameFromSlug("https://www.linkedin.com/in/anika-achterberg-1a2b3c4")).toBe(
      "Anika Achterberg",
    );
  });

  // Dropping every segment would leave an empty display_name, and the column is
  // not null. A handle is a name, it is just not a first and last one.
  it("keeps a handle that is entirely digits and letters", () => {
    expect(displayNameFromSlug("https://www.linkedin.com/in/8bitdave")).toBe("8bitdave");
  });
});

describe("price per post", () => {
  it("reads whole units into cents", () => {
    expect(ok<number>(parsePriceCents("1200"))).toBe(120_000);
  });

  /**
   * The reason this is parsed off the string. `12.10 * 100` is
   * 1209.9999999999998, so a float path rounds a cent off every read.
   */
  it("reads a fractional price exactly", () => {
    expect(ok<number>(parsePriceCents("12.10"))).toBe(1210);
    expect(ok<number>(parsePriceCents("1200.5"))).toBe(120_050);
    expect(ok<number>(parsePriceCents("1,200"))).toBe(120_000);
  });

  it("accepts a free listing", () => {
    expect(ok<number>(parsePriceCents("0"))).toBe(0);
  });

  it.each(["", "-50", "12.345", "1e5", "twelve", "$1200"])("rejects %j", (input) => {
    expect(parsePriceCents(input).kind).toBe("invalid");
  });

  // price_cents is a Postgres int; past that the insert fails at the database
  // with an error nobody on the screen can act on.
  it("rejects a price larger than the column can hold", () => {
    // 21,474,836.47 is the largest price the int column holds, to the cent.
    expect(parsePriceCents("21474836.47").kind).toBe("ok");
    expect(parsePriceCents("21474836.48").kind).toBe("invalid");
    expect(parsePriceCents("999999999").kind).toBe("invalid");
  });
});

describe("industries", () => {
  it("takes up to three", () => {
    expect(ok<string[]>(parseTopicIds([TOPIC_A, TOPIC_B, TOPIC_C]))).toEqual([
      TOPIC_A,
      TOPIC_B,
      TOPIC_C,
    ]);
  });

  it("collapses a repeated checkbox rather than failing the primary key", () => {
    expect(ok<string[]>(parseTopicIds([TOPIC_A, TOPIC_A]))).toEqual([TOPIC_A]);
  });

  it("rejects a fourth, which the database trigger would reject anyway", () => {
    expect(
      parseTopicIds([TOPIC_A, TOPIC_B, TOPIC_C, "12345678-1234-4234-8234-123456789012"]).kind,
    ).toBe("invalid");
  });

  // A listing with no industry cannot be reached by any marketplace filter.
  it("requires at least one", () => {
    expect(parseTopicIds([]).kind).toBe("invalid");
  });

  it("rejects anything that is not a uuid", () => {
    expect(parseTopicIds(["saas"]).kind).toBe("invalid");
  });
});

describe("the whole screen", () => {
  function form(fields: Record<string, string | string[]>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
    }
    return data;
  }

  it("parses a filled-in screen", () => {
    const result = parseCreatorListing(
      form({
        linkedinUrl: "linkedin.com/in/mateo-jansen-1a2b3c4",
        topics: [TOPIC_A, TOPIC_B],
        price: "1200",
      }),
    );

    expect(result).toEqual({
      kind: "ok",
      value: {
        linkedinUrl: "https://www.linkedin.com/in/mateo-jansen-1a2b3c4",
        displayName: "Mateo Jansen",
        topicIds: [TOPIC_A, TOPIC_B],
        priceCents: 120_000,
      },
    });
  });

  it("reports the first thing wrong rather than the last", () => {
    const result = parseCreatorListing(
      form({ linkedinUrl: "nonsense", topics: [], price: "free" }),
    );

    expect(result.kind).toBe("invalid");
    expect(result).toMatchObject({ error: expect.stringContaining("URL") });
  });
});
