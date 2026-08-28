/**
 * The seniority ladder.
 *
 * `icp_target.value` and `audience_facet.value` both hold these slugs for the
 * seniority dimension, and the score joins the two tables on (dimension,
 * value) — so this list is the whole vocabulary, in one place, for the same
 * reason `src/lib/geo/regions.ts` exists.
 *
 * It lived in two places before: the labels here and the ordered list the seed
 * writes audience facets from. Two copies of a vocabulary is the drift
 * PRODUCT.md's "One taxonomy" section is about, in miniature.
 *
 * Ordered from junior to senior. The ICP editor renders it in this order and a
 * reader expects a ladder to be one.
 */

export const SENIORITY_LADDER: ReadonlyArray<readonly [string, string]> = [
  ["ic", "Individual contributor"],
  ["senior", "Senior"],
  ["lead", "Lead"],
  ["manager", "Manager"],
  ["director", "Director"],
  ["vp", "VP"],
  ["c-level", "C-level"],
  ["founder", "Founder"],
];

export const SENIORITIES: ReadonlyArray<string> = SENIORITY_LADDER.map(([slug]) => slug);

export const SENIORITY_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  SENIORITY_LADDER,
);

const KNOWN = new Set(SENIORITIES);

export function isSeniority(value: unknown): value is string {
  return typeof value === "string" && KNOWN.has(value);
}
