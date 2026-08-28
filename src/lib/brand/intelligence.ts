/**
 * Website → brand profile and three ICPs (PRODUCT.md step 2).
 *
 * SCOPE.md lists this as a fake behind a named seam: "One LLM call over the
 * pasted URL's text, or a fixture for known demo domains —
 * `BrandIntelligenceProvider`". This file is that seam, plus the parser
 * standing between whatever a model says and anything this product stores.
 *
 * The parser is the point. CLAUDE.md requires LLM output to be parsed into a
 * known shape and to fail loudly when it does not match, and it is on the short
 * list of things that get tests. What comes back is scored against for the rest
 * of the workspace's life — a hallucinated industry or a geo spelled "UK"
 * becomes an `icp_target` row that silently matches no audience facet, and then
 * a score that is confidently wrong. Wrong is worse than absent here, so
 * anything outside the vocabulary is refused rather than dropped.
 */

import { invalid, ok, type ParseResult } from "@/lib/parse";
import { isSupportedRegion } from "@/lib/geo/regions";
import { isSeniority } from "@/lib/taxonomy/seniority";
import { isSizeBand } from "@/lib/taxonomy/size-bands";
import type { TopicRow } from "@/lib/score/labels";
import type { ScoreDimension } from "@/lib/score/weights";

/** PRODUCT.md: three ICPs, ranked 1..3. `icp` has a unique (workspace, rank). */
export const ICP_COUNT = 3;

/*
 * Ceilings, not targets. Every one of these is a text column with no length
 * constraint behind it, so these exist to stop a model writing an essay into a
 * field the UI renders in one line — not to shape the writing.
 */
const MAX_COMPANY_NAME = 120;
const MAX_TAGLINE = 200;
const MAX_VALUE_PROP = 2000;
const MAX_ICP_LABEL = 120;
const MAX_ICP_DESCRIPTION = 1000;

export type IcpTargets = Readonly<Record<ScoreDimension, ReadonlyArray<string>>>;

export type GeneratedIcp = {
  readonly label: string;
  readonly description: string;
  readonly targets: IcpTargets;
};

export type GeneratedProfile = {
  readonly companyName: string;
  readonly tagline: string;
  readonly valueProp: string;
  /** A `topic` slug. The writer resolves it to `brand_profile.industry_id`. */
  readonly industry: string;
  readonly sizeBand: string;
};

export type BrandIntelligence = {
  readonly profile: GeneratedProfile;
  readonly icps: ReadonlyArray<GeneratedIcp>;
};

/**
 * The slugs a generated answer is allowed to use.
 *
 * Industries and job functions are rows in `topic`, so they are passed in
 * rather than imported: the vocabulary is whatever the database holds, and a
 * second hardcoded copy here would be the drift "One taxonomy" exists to stop.
 * Seniorities and regions are static lists and are read directly.
 */
export type Vocabulary = {
  readonly industries: ReadonlySet<string>;
  readonly functions: ReadonlySet<string>;
};

export function buildVocabulary(topics: ReadonlyArray<TopicRow>): Vocabulary {
  const industries = new Set<string>();
  const functions = new Set<string>();

  for (const topic of topics) {
    if (topic.kind === "industry") industries.add(topic.slug);
    else functions.add(topic.slug);
  }

  return { industries, functions };
}

export type BrandIntelligenceRequest = {
  /** The normalised URL, for the model's own context. */
  readonly website: string;
  /** Text extracted from that page. Never HTML. */
  readonly text: string;
};

/**
 * Three outcomes, kept apart because they are three different sentences on the
 * screen and the brand does something different about each.
 *
 * `unavailable` is "we could not ask" — no key configured, the provider is
 * down, the site would not load. `unusable` is "we asked and the answer was not
 * one we can store". Neither invents an ICP; both land the brand in the editor
 * with the reason showing.
 */
export type GenerationResult =
  | {
      readonly kind: "ok";
      readonly intelligence: BrandIntelligence;
      readonly source: "fixture" | "model";
    }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "unusable"; readonly reason: string };

export interface BrandIntelligenceProvider {
  /** Named so the screen can say where an answer came from. */
  readonly name: string;
  generate(
    request: BrandIntelligenceRequest,
    vocabulary: Vocabulary,
  ): Promise<GenerationResult>;
}

/**
 * Whether a value may be stored as a target on this dimension.
 *
 * The one rule, shared by the generated answer and the editor's form. Both
 * write `icp_target` rows, and a row the score cannot join to is equally
 * useless whichever of them produced it.
 */
export function isKnownTargetValue(
  dimension: ScoreDimension,
  value: string,
  vocabulary: Vocabulary,
): boolean {
  switch (dimension) {
    case "job_function":
      return vocabulary.functions.has(value);
    case "industry":
      return vocabulary.industries.has(value);
    case "seniority":
      return isSeniority(value);
    case "geo":
      return isSupportedRegion(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(
  raw: unknown,
  label: string,
  max: number,
  { required = true }: { required?: boolean } = {},
): ParseResult<string> {
  if (typeof raw !== "string") {
    return required ? invalid(`${label} is missing.`) : ok("");
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return required ? invalid(`${label} came back empty.`) : ok("");
  }
  if (trimmed.length > max) {
    return invalid(`${label} is longer than ${max} characters.`);
  }

  return ok(trimmed);
}

/**
 * One dimension's target set.
 *
 * Unknown values fail the whole generation rather than being dropped. The two
 * tables the score joins — `icp_target` and `audience_facet` — match on
 * (dimension, value), so a value outside the vocabulary is not a slightly worse
 * target, it is one that can never match anything. Dropping it would leave an
 * ICP that looks complete and scores as though a dimension were never asked
 * for.
 */
function targetSet(
  raw: unknown,
  dimension: ScoreDimension,
  label: string,
  vocabulary: Vocabulary,
): ParseResult<string[]> {
  if (raw === undefined || raw === null) return ok([]);
  if (!Array.isArray(raw)) return invalid(`${label} came back as something other than a list.`);

  const values: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || entry.trim() === "") {
      return invalid(`${label} contains an entry that is not a value.`);
    }
    const value = entry.trim();
    if (!isKnownTargetValue(dimension, value, vocabulary)) {
      return invalid(`${label} contains "${value}", which is not in the ${dimension} vocabulary.`);
    }
    if (!values.includes(value)) values.push(value);
  }

  return ok(values);
}

function parseTargets(raw: unknown, vocabulary: Vocabulary): ParseResult<IcpTargets> {
  if (!isRecord(raw)) return invalid("An ICP came back without its targets.");

  const jobFunction = targetSet(raw.job_function, "job_function", "Job functions", vocabulary);
  if (jobFunction.kind === "invalid") return jobFunction;

  const seniority = targetSet(raw.seniority, "seniority", "Seniorities", vocabulary);
  if (seniority.kind === "invalid") return seniority;

  const industry = targetSet(raw.industry, "industry", "Industries", vocabulary);
  if (industry.kind === "invalid") return industry;

  const geo = targetSet(raw.geo, "geo", "Regions", vocabulary);
  if (geo.kind === "invalid") return geo;

  const total =
    jobFunction.value.length + seniority.value.length + industry.value.length + geo.value.length;

  /*
   * An ICP with no targets at all is unscoreable — `scoreCreator` says so and
   * the marketplace refuses to rank against it. It is a legitimate state for a
   * human to leave an ICP in while editing, and never a legitimate thing to
   * generate.
   */
  if (total === 0) {
    return invalid("An ICP came back with no targets, so nothing could be scored against it.");
  }

  return ok({
    job_function: jobFunction.value,
    seniority: seniority.value,
    industry: industry.value,
    geo: geo.value,
  });
}

function parseIcp(raw: unknown, vocabulary: Vocabulary): ParseResult<GeneratedIcp> {
  if (!isRecord(raw)) return invalid("An ICP came back as something other than an object.");

  const label = text(raw.label, "An ICP label", MAX_ICP_LABEL);
  if (label.kind === "invalid") return label;

  // The paragraph is what a human reads and what brief generation is given.
  // Nothing scores against it, so an empty one is a poorer ICP, not a broken one.
  const description = text(raw.description, "An ICP description", MAX_ICP_DESCRIPTION, {
    required: false,
  });
  if (description.kind === "invalid") return description;

  const targets = parseTargets(raw.targets, vocabulary);
  if (targets.kind === "invalid") return targets;

  return ok({ label: label.value, description: description.value, targets: targets.value });
}

function parseProfile(raw: unknown, vocabulary: Vocabulary): ParseResult<GeneratedProfile> {
  if (!isRecord(raw)) return invalid("The brand profile came back as something other than an object.");

  const companyName = text(raw.companyName, "The company name", MAX_COMPANY_NAME);
  if (companyName.kind === "invalid") return companyName;

  const tagline = text(raw.tagline, "The tagline", MAX_TAGLINE, { required: false });
  if (tagline.kind === "invalid") return tagline;

  const valueProp = text(raw.valueProp, "The value proposition", MAX_VALUE_PROP);
  if (valueProp.kind === "invalid") return valueProp;

  if (typeof raw.industry !== "string" || !vocabulary.industries.has(raw.industry)) {
    return invalid(
      `The brand's industry came back as "${String(raw.industry)}", which is not one of ours.`,
    );
  }

  if (!isSizeBand(raw.sizeBand)) {
    return invalid(`The company size came back as "${String(raw.sizeBand)}", which is not a band we use.`);
  }

  return ok({
    companyName: companyName.value,
    tagline: tagline.value,
    valueProp: valueProp.value,
    industry: raw.industry,
    sizeBand: raw.sizeBand,
  });
}

/**
 * Everything a generated answer has to be before it is written.
 *
 * Strict on purpose, and strict about values rather than only about shape. The
 * model is given the vocabulary in its schema, so a value outside it means the
 * answer was not produced against the taxonomy this product scores with — and
 * an ICP written from a different vocabulary is worse than no ICP, because it
 * looks like one.
 */
export function parseBrandIntelligence(
  value: unknown,
  vocabulary: Vocabulary,
): ParseResult<BrandIntelligence> {
  if (!isRecord(value)) return invalid("The answer was not an object.");

  const profile = parseProfile(value.profile, vocabulary);
  if (profile.kind === "invalid") return profile;

  if (!Array.isArray(value.icps)) return invalid("The answer carried no list of ICPs.");
  if (value.icps.length !== ICP_COUNT) {
    return invalid(
      `The answer carried ${value.icps.length} ICPs; this product ranks exactly ${ICP_COUNT}.`,
    );
  }

  const icps: GeneratedIcp[] = [];
  for (const raw of value.icps) {
    const icp = parseIcp(raw, vocabulary);
    if (icp.kind === "invalid") return icp;
    icps.push(icp.value);
  }

  return ok({ profile: profile.value, icps });
}
