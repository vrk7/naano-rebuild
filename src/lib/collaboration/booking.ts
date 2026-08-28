/**
 * Parsing the booking screen (PRODUCT.md step 7).
 *
 * Three fields — price, `post_by`, and whether the brand wants to approve the
 * draft — and the third is the one that changes the state machine's shape for
 * the rest of the collaboration. Pure, so the money arithmetic and the date
 * boundary can be tested without a request.
 *
 * naano's own offer form has discount presets and a custom price
 * (`recon/brand/14`); SCOPE.md cuts negotiation, so this is one price, sent
 * once, accepted or declined.
 */

import { invalid, ok, type ParseResult } from "@/lib/parse";
import { RESPOND_WINDOW_HOURS, respondByFrom } from "./machine";

/** `collaboration.price_cents` is a Postgres `int`. Beyond this the insert fails. */
const MAX_PRICE_CENTS = 2_147_483_647;

export type BookingInput = {
  readonly priceCents: number;
  /** ISO `YYYY-MM-DD`. `collaboration.post_by` is a `date`, with no time in it. */
  readonly postBy: string;
  readonly approvalRequired: boolean;
};

/**
 * A price typed by a human, in dollars, into cents.
 *
 * Parsed as digits rather than through `Number(...) * 100`, which turns 19.99
 * into 1998.9999999999998 and then into a price nobody typed. Everything stays
 * integer from here on, as `posts/metrics.ts` requires.
 */
export function parsePriceCents(raw: unknown): ParseResult<number> {
  if (typeof raw !== "string" || raw.trim() === "") {
    return invalid("Set a price for this post.");
  }

  // A pasted price carries the currency and the thousands separators with it.
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return invalid("Write the price as a number of dollars, like 1500 or 1500.50.");
  }

  const [, whole, fraction = ""] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (cents === 0) {
    return invalid("A booking commits a price. Zero is not one.");
  }
  if (cents > MAX_PRICE_CENTS) {
    return invalid("That price is larger than this product can record.");
  }

  return ok(cents);
}

/**
 * What the date field opens on.
 *
 * 14 days is the default horizon naano's own offer form uses (`recon/brand/14`)
 * and it is inherited rather than measured. It is only where the field starts —
 * the brand types over it — so it sets no rule and nothing downstream reads it.
 */
export const DEFAULT_POST_BY_DAYS = 14;

/** The UTC calendar day of an instant, as the `date` column stores it. */
function isoDay(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * The earliest date a post can be due.
 *
 * Not an invented lead time: it is the day the creator's 72-hour window to
 * answer closes. A post due before the creator has to reply is a booking that
 * commits money against a deadline nobody could meet.
 */
export function earliestPostBy(now: Date): string {
  return isoDay(respondByFrom(now));
}

export function defaultPostBy(now: Date): string {
  return isoDay(new Date(now.getTime() + DEFAULT_POST_BY_DAYS * 24 * 60 * 60 * 1000));
}

export function parsePostBy(raw: unknown, now: Date): ParseResult<string> {
  if (typeof raw !== "string" || raw.trim() === "") {
    return invalid("Set a date for the post to go out by.");
  }

  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return invalid("Write the date as YYYY-MM-DD.");
  }

  // Round-tripping catches 2026-02-31, which the pattern above accepts and the
  // Date constructor silently rolls forward into March.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || isoDay(parsed) !== value) {
    return invalid("That is not a real date.");
  }

  const earliest = earliestPostBy(now);
  if (value < earliest) {
    return invalid(
      `The creator has ${RESPOND_WINDOW_HOURS} hours to answer, so the earliest date a post can be due is ${earliest}.`,
    );
  }

  return ok(value);
}

export function parseBookingForm(formData: FormData, now: Date): ParseResult<BookingInput> {
  const price = parsePriceCents(formData.get("price"));
  if (price.kind === "invalid") return price;

  const postBy = parsePostBy(formData.get("post_by"), now);
  if (postBy.kind === "invalid") return postBy;

  /*
   * An unchecked checkbox is absent from the submission, so this reads as
   * false rather than defaulting to true. The form ships it checked; a brand
   * that unticks it has said the creator may publish without a review, and
   * PRODUCT.md's machine takes them straight from drafting to approved.
   */
  const approvalRequired = formData.get("approval_required") === "on";

  return ok({ priceCents: price.value, postBy: postBy.value, approvalRequired });
}
