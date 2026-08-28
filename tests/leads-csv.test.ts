import { describe, expect, it } from "vitest";

import { escapeField, neutraliseFormula, toCsv, toCsvRow } from "@/lib/leads/csv";

/**
 * The export is the one place this product hands its data to something else,
 * and a mis-escaped field does not throw — it shifts every later column of that
 * row under the wrong header. That silence is why this is tested.
 */

describe("escapeField", () => {
  it("leaves an ordinary field alone", () => {
    expect(escapeField("Marta Lindqvist")).toBe("Marta Lindqvist");
  });

  it("quotes a field containing a comma", () => {
    expect(escapeField("Vantage Castings, GmbH")).toBe('"Vantage Castings, GmbH"');
  });

  it("doubles embedded quotes and wraps the field", () => {
    expect(escapeField('Head of "Special" Projects')).toBe(
      '"Head of ""Special"" Projects"',
    );
  });

  it.each([["\n"], ["\r"], ["\r\n"]])("quotes a field containing %j", (newline) => {
    expect(escapeField(`one${newline}two`)).toBe(`"one${newline}two"`);
  });

  it("leaves an empty field empty rather than quoting it", () => {
    expect(escapeField("")).toBe("");
  });
});

describe("neutraliseFormula", () => {
  it.each(["=", "+", "-", "@"])(
    "prefixes a value starting with %s so a spreadsheet keeps it as text",
    (lead) => {
      expect(neutraliseFormula(`${lead}HYPERLINK("http://x")`)).toBe(
        `'${lead}HYPERLINK("http://x")`,
      );
    },
  );

  it("does not alter a name that merely contains a hyphen", () => {
    expect(neutraliseFormula("Anne-Marie Dubois")).toBe("Anne-Marie Dubois");
  });

  it("leaves an ordinary value untouched", () => {
    expect(neutraliseFormula("Acme")).toBe("Acme");
  });
});

describe("toCsvRow", () => {
  it("escapes and joins in one pass", () => {
    expect(toCsvRow(["a", "b,c", '"d"'])).toBe('a,"b,c","""d"""');
  });

  it("neutralises a formula and then quotes it if it also needs quoting", () => {
    // The prefix goes on first, so the quoting sees the final value.
    expect(toCsvRow(["=1,2"])).toBe(`"'=1,2"`);
  });
});

describe("toCsv", () => {
  it("emits CRLF line endings and a trailing newline", () => {
    const csv = toCsv(["name", "score"], [["Marta", "94"], ["Tobias", "78"]]);
    expect(csv).toBe("name,score\r\nMarta,94\r\nTobias,78\r\n");
  });

  it("emits just the header when there are no rows", () => {
    expect(toCsv(["name"], [])).toBe("name\r\n");
  });
});
