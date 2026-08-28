/**
 * Company headcount bands.
 *
 * `brand_profile.size_band` and `company.size_band` are both plain text with no
 * constraint behind them, so this list is the only thing keeping a generated
 * "51-200" and a seeded "51–200" from being two different bands. It is a
 * vocabulary rather than a number: nothing computes with it, and a brand
 * reading "201-500" learns as much as it would from an exact headcount nobody
 * has.
 */

export const SIZE_BANDS: ReadonlyArray<string> = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001+",
];

const KNOWN = new Set(SIZE_BANDS);

export function isSizeBand(value: unknown): value is string {
  return typeof value === "string" && KNOWN.has(value);
}
