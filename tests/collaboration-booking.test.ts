import { describe, expect, it } from "vitest";

import {
  earliestPostBy,
  parseBookingForm,
  parsePostBy,
  parsePriceCents,
} from "@/lib/collaboration/booking";
import { RESPOND_WINDOW_HOURS } from "@/lib/collaboration/machine";
import type { ParseResult } from "@/lib/parse";

/**
 * The booking form.
 *
 * The price becomes a `commit` ledger entry against the wallet the moment this
 * parses, which puts it under "budget and projection math" on CLAUDE.md's test
 * list. A price that arrives a cent out is money committed that nobody typed.
 */

const NOW = new Date("2026-08-28T12:00:00.000Z");

function ok<T>(result: ParseResult<T>): T {
  expect(result).toMatchObject({ kind: "ok" });
  if (result.kind !== "ok") throw new Error(result.error);
  return result.value;
}

function error<T>(result: ParseResult<T>): string {
  expect(result).toMatchObject({ kind: "invalid" });
  if (result.kind !== "invalid") throw new Error(`expected an error, got ${String(result.value)}`);
  return result.error;
}

describe("price", () => {
  it("reads whole dollars", () => {
    expect(ok(parsePriceCents("1500"))).toBe(150_000);
  });

  it("reads the currency and separators people paste with it", () => {
    expect(ok(parsePriceCents(" $1,500.50 "))).toBe(150_050);
  });

  /**
   * The case this parser exists for: 19.99 through `Number(x) * 100` is
   * 1998.9999999999998, and rounding it later is a price nobody typed.
   */
  it("keeps cents exact", () => {
    expect(ok(parsePriceCents("19.99"))).toBe(1999);
    expect(ok(parsePriceCents("0.07"))).toBe(7);
    expect(ok(parsePriceCents("1500.5"))).toBe(150_050);
  });

  it("refuses a price that is not one", () => {
    expect(error(parsePriceCents(""))).toMatch(/set a price/i);
    expect(error(parsePriceCents("free"))).toMatch(/number of dollars/i);
    expect(error(parsePriceCents("1500.005"))).toMatch(/number of dollars/i);
    expect(error(parsePriceCents("-500"))).toMatch(/number of dollars/i);
  });

  it("refuses zero, which commits nothing", () => {
    expect(error(parsePriceCents("0"))).toMatch(/zero/i);
    expect(error(parsePriceCents("0.00"))).toMatch(/zero/i);
  });

  /** `collaboration.price_cents` is an int; past that the insert fails anyway. */
  it("refuses a price the column cannot hold", () => {
    expect(error(parsePriceCents("21474836.48"))).toMatch(/larger/i);
    expect(ok(parsePriceCents("21474836.47"))).toBe(2_147_483_647);
  });
});

describe("post_by", () => {
  it("is the day the respond window closes, at the earliest", () => {
    // 72 hours from noon on the 28th is noon on the 31st.
    expect(earliestPostBy(NOW)).toBe("2026-08-31");
    expect(RESPOND_WINDOW_HOURS).toBe(72);

    expect(ok(parsePostBy("2026-08-31", NOW))).toBe("2026-08-31");
    expect(error(parsePostBy("2026-08-30", NOW))).toMatch(/72 hours/);
  });

  it("refuses a date that is not real", () => {
    // Accepted by the pattern, rolled silently into March by Date.
    expect(error(parsePostBy("2026-02-31", NOW))).toMatch(/not a real date/i);
    expect(error(parsePostBy("31/08/2026", NOW))).toMatch(/YYYY-MM-DD/);
    expect(error(parsePostBy("", NOW))).toMatch(/set a date/i);
  });
});

describe("the whole form", () => {
  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    return data;
  }

  it("parses a booking", () => {
    expect(
      ok(
        parseBookingForm(
          form({ price: "2,400", post_by: "2026-09-15", approval_required: "on" }),
          NOW,
        ),
      ),
    ).toEqual({ priceCents: 240_000, postBy: "2026-09-15", approvalRequired: true });
  });

  /**
   * An unchecked box is absent from the submission. Reading that as false is
   * what sends the creator from drafting straight to approved, so it has to be
   * the absence and not a default.
   */
  it("treats a missing approval box as not required", () => {
    expect(
      ok(parseBookingForm(form({ price: "2400", post_by: "2026-09-15" }), NOW)).approvalRequired,
    ).toBe(false);
  });

  it("stops at the first thing a person can fix", () => {
    expect(
      error(parseBookingForm(form({ price: "", post_by: "2026-01-01" }), NOW)),
    ).toMatch(/set a price/i);
  });
});
