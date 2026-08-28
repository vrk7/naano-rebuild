/**
 * Turning stored facet values back into English.
 *
 * `icp_target.value` and `audience_facet.value` are deliberately heterogeneous
 * (PRODUCT.md, "One taxonomy"): a topic id for industry, ISO-3166 for geo, a
 * slug for the rest. That is right for scoring — the two tables join on
 * (dimension, value) — and useless for reading. Everything that puts a target
 * or a facet on screen goes through here so a uuid never reaches a user.
 */

import type { ScoreDimension } from "./weights";

export type TopicRow = {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly kind: "industry" | "function";
};

export const DIMENSION_LABEL: Readonly<Record<ScoreDimension, string>> = {
  job_function: "Job function",
  seniority: "Seniority",
  industry: "Industry",
  geo: "Region",
};

/** Matches the seniority ladder in src/lib/seed/taxonomy.ts. */
const SENIORITY_LABEL: Readonly<Record<string, string>> = {
  ic: "Individual contributor",
  senior: "Senior",
  lead: "Lead",
  manager: "Manager",
  director: "Director",
  vp: "VP",
  "c-level": "C-level",
  founder: "Founder",
};

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/**
 * `Intl.DisplayNames.of` throws a RangeError on anything that is not a
 * well-formed region subtag, so the shape is checked before asking.
 */
function regionLabel(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return code;
  return REGION_NAMES.of(code.toUpperCase()) ?? code;
}

export type TaxonomyLookup = {
  /** English for one stored facet value. */
  readonly labelFor: (dimension: ScoreDimension, value: string) => string;
  /**
   * English for a bare `topic.id`, whichever kind it is. `creator_topic` holds
   * ids without a dimension to disambiguate them, so it cannot go through
   * `labelFor`.
   */
  readonly labelForTopicId: (id: string) => string;
};

/**
 * Builds the lookup from the `topic` table, which is the single vocabulary both
 * sides of the score are written against.
 *
 * An unrecognised value falls through as itself rather than as "Unknown".
 * `icp_target.value` is text with no foreign key, so a topic deleted out from
 * under a target really can orphan one — and a stray uuid on the screen names
 * the broken row, where "Unknown industry" would hide which one it was.
 */
export function buildTaxonomyLookup(
  topics: ReadonlyArray<TopicRow>,
): TaxonomyLookup {
  const industryById = new Map<string, string>();
  const functionBySlug = new Map<string, string>();
  const byId = new Map<string, string>();

  for (const topic of topics) {
    byId.set(topic.id, topic.label);
    if (topic.kind === "industry") industryById.set(topic.id, topic.label);
    else functionBySlug.set(topic.slug, topic.label);
  }

  return {
    labelForTopicId(id) {
      return byId.get(id) ?? id;
    },
    labelFor(dimension, value) {
      switch (dimension) {
        case "industry":
          return industryById.get(value) ?? value;
        case "job_function":
          return functionBySlug.get(value) ?? value;
        case "seniority":
          return SENIORITY_LABEL[value] ?? value;
        case "geo":
          return regionLabel(value);
      }
    },
  };
}

/**
 * Joins a target set for display, keeping it to a readable length.
 *
 * A dimension can carry eight geos; spelling all of them out in a table cell
 * pushes the numbers off screen, and the numbers are the point.
 */
export function summariseTargets(
  labels: ReadonlyArray<string>,
  max = 3,
): string {
  if (labels.length === 0) return "—";
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max} more`;
}
