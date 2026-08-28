/**
 * The one taxonomy (PRODUCT.md, "One taxonomy").
 *
 * naano runs two vocabularies — creators pick from ~28 industries while brands
 * filter on about six — so a creator's third industry is unreachable by any
 * brand filter. These lists are the single source for creator_topic,
 * icp_target, brand_profile.industry_id and the marketplace filters.
 */

export type TopicSeed = {
  readonly slug: string;
  readonly label: string;
  readonly kind: "industry" | "function";
};

const INDUSTRY_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["saas", "SaaS"],
  ["fintech", "Fintech"],
  ["ecommerce", "E-commerce"],
  ["healthtech", "Health Tech"],
  ["edtech", "Ed Tech"],
  ["cybersecurity", "Cybersecurity"],
  ["ai-ml", "AI & Machine Learning"],
  ["data-analytics", "Data & Analytics"],
  ["devtools", "Developer Tools"],
  ["cloud-infrastructure", "Cloud Infrastructure"],
  ["manufacturing", "Manufacturing"],
  ["industrial-equipment", "Industrial Equipment"],
  ["logistics", "Logistics"],
  ["supply-chain", "Supply Chain"],
  ["automotive", "Automotive"],
  ["energy", "Energy"],
  ["construction", "Construction"],
  ["real-estate", "Real Estate"],
  ["retail", "Retail"],
  ["hospitality", "Hospitality"],
  ["media", "Media & Publishing"],
  ["gaming", "Gaming"],
  ["telecom", "Telecommunications"],
  ["professional-services", "Professional Services"],
  ["consulting", "Consulting"],
  ["legal", "Legal"],
  ["insurance", "Insurance"],
  ["agriculture", "Agriculture"],
];

const FUNCTION_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["engineering", "Engineering"],
  ["sales", "Sales"],
  ["marketing", "Marketing"],
  ["product", "Product"],
  ["design", "Design"],
  ["data", "Data"],
  ["operations", "Operations"],
  ["finance", "Finance"],
  ["hr", "People & HR"],
  ["legal-function", "Legal"],
  ["customer-success", "Customer Success"],
  ["executive", "Executive"],
];

export const INDUSTRY_TOPICS: ReadonlyArray<TopicSeed> = INDUSTRY_LABELS.map(
  ([slug, label]) => ({ slug, label, kind: "industry" as const }),
);

export const FUNCTION_TOPICS: ReadonlyArray<TopicSeed> = FUNCTION_LABELS.map(
  ([slug, label]) => ({ slug, label, kind: "function" as const }),
);

export const ALL_TOPICS: ReadonlyArray<TopicSeed> = [
  ...INDUSTRY_TOPICS,
  ...FUNCTION_TOPICS,
];

/**
 * job_function and seniority values are stored as these slugs rather than as
 * topic ids. PRODUCT.md specifies `icp_target.value` as "topic_id for industry,
 * ISO-3166 for geo, enum for the rest" — audience_facet follows the same
 * convention so the two join on (dimension, value).
 */
export const JOB_FUNCTIONS: ReadonlyArray<string> = FUNCTION_TOPICS.map(
  (t) => t.slug,
);

export const SENIORITIES: ReadonlyArray<string> = [
  "ic",
  "senior",
  "lead",
  "manager",
  "director",
  "vp",
  "c-level",
  "founder",
];

/**
 * ISO-3166 alpha-2. Re-exported from the app's own list rather than repeated:
 * the seed writes the geo facets that `campaign.geos` and `icp_target` are
 * later matched against, so a second copy here would drift out of a shared
 * vocabulary into two.
 */
export { SUPPORTED_REGIONS as GEOS } from "@/lib/geo/regions";

/** The regions a European industrial ICP would actually target. */
export const EU_CORE_GEOS: ReadonlyArray<string> = ["DE", "FR", "NL", "GB", "SE", "PL", "IT", "ES"];
