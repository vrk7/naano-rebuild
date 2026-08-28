/**
 * The regions this product knows about, as ISO-3166 alpha-2.
 *
 * One list, for the same reason there is one topic taxonomy (PRODUCT.md, "One
 * taxonomy"): `audience_facet.value` for the geo dimension, `icp_target.value`
 * for the geo dimension, and `campaign.geos` all draw on it. A campaign that
 * targets a code no audience is ever recorded against is a filter that silently
 * matches nothing, which is the two-vocabulary drift naano ships between its
 * creator industries and its brand filters.
 *
 * Labels are not stored here — `Intl.DisplayNames` has them, and
 * `src/lib/score/labels.ts` is where a stored value becomes English.
 */

export const SUPPORTED_REGIONS: ReadonlyArray<string> = [
  "US", "GB", "DE", "FR", "NL", "ES", "IT", "SE", "PL", "IE",
  "CA", "AU", "SG", "AE", "IN", "PK", "NG", "BR", "MX", "ZA",
];

const SUPPORTED = new Set(SUPPORTED_REGIONS);

export function isSupportedRegion(code: unknown): code is string {
  return typeof code === "string" && SUPPORTED.has(code);
}
