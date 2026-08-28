/**
 * Parsing a top-up amount from the form (SCOPE.md, "Wallet top-up").
 *
 * Dollars in, integer cents out. The rounding matters: everything downstream —
 * the ledger, the balance, cost per matched person — stays in integer cents,
 * and a float that slips through here is a fraction of a cent that stops the
 * ledger reconciling with the balance it is supposed to explain.
 */

/** A top-up nobody would mean, and a cap so a typo cannot break the column. */
const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000_00;

export type ParsedAmount =
  | { readonly kind: "ok"; readonly value: number }
  | { readonly kind: "invalid"; readonly error: string };

export function parseTopupCents(raw: FormDataEntryValue | null): ParsedAmount {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { kind: "invalid", error: "Enter an amount." };
  }

  const cleaned = raw.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { kind: "invalid", error: "Enter an amount in dollars, like 2500 or 2500.00." };
  }

  const cents = Math.round(Number(cleaned) * 100);

  if (cents < MIN_CENTS) return { kind: "invalid", error: "The smallest top-up is $1." };
  if (cents > MAX_CENTS) {
    return { kind: "invalid", error: "That is larger than this demo will accept." };
  }

  return { kind: "ok", value: cents };
}
