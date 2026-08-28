import { describe, expect, it } from "vitest";

import { parseTopupCents } from "@/lib/wallet/parse";

/**
 * Budget math, one of the four things CLAUDE.md requires tests for. Everything
 * downstream stays in integer cents, so the case that matters is the one where
 * a float would slip through and stop the ledger reconciling with the balance.
 */

function ok(raw: string): number {
  const parsed = parseTopupCents(raw);
  if (parsed.kind !== "ok") throw new Error(`expected ok, got: ${parsed.error}`);
  return parsed.value;
}

describe("parseTopupCents", () => {
  it("reads whole dollars as cents", () => {
    expect(ok("2500")).toBe(250_000);
  });

  it("reads two decimal places exactly", () => {
    expect(ok("2500.75")).toBe(250_075);
  });

  it("reads one decimal place as tenths, not hundredths", () => {
    expect(ok("10.5")).toBe(1050);
  });

  it("rounds rather than truncating, so the cent is not lost", () => {
    // 0.1 + 0.2 style drift: 19.99 * 100 is 1998.9999... in binary float.
    expect(ok("19.99")).toBe(1999);
    expect(ok("1234.56")).toBe(123_456);
  });

  it("accepts a leading dollar sign and thousands separators", () => {
    expect(ok("$1,250.00")).toBe(125_000);
  });

  it.each(["", "   ", "abc", "1.234", "-50", "1e3", "$", "1..2"])(
    "refuses %j",
    (raw) => {
      expect(parseTopupCents(raw).kind).toBe("invalid");
    },
  );

  it("refuses a null field", () => {
    expect(parseTopupCents(null).kind).toBe("invalid");
  });

  it("refuses an amount below the floor", () => {
    expect(parseTopupCents("0.5").kind).toBe("invalid");
    expect(parseTopupCents("0").kind).toBe("invalid");
  });

  it("accepts the floor itself", () => {
    expect(ok("1")).toBe(100);
  });

  it("refuses an amount past the cap", () => {
    expect(parseTopupCents("2000000").kind).toBe("invalid");
  });

  it("accepts the cap itself", () => {
    expect(ok("1000000")).toBe(1_000_000_00);
  });
});
