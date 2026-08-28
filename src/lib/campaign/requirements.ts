/**
 * `brief.requirements` — the structured half of a brief.
 *
 * PRODUCT.md specifies the stored shape exactly, so the keys here are the
 * snake_case ones that go into jsonb rather than the camelCase the rest of the
 * codebase uses. This is a wire format, and renaming it on the way in would
 * mean renaming it back for every deterministic check that reads it later.
 *
 * ```jsonc
 * {
 *   "must_mention":     ["Atira", "RFQ turnaround"],
 *   "must_include_link": true,
 *   "banned_claims":    ["guaranteed", "fastest in the world"],
 *   "length":           { "min": 400, "max": 1800 },   // characters
 *   "requires_disclosure": true
 * }
 * ```
 *
 * Every field is optional, and `creative_freedom` means `{}` — every check that
 * reads it then passes vacuously. Absent is stored as absent: a `must_mention`
 * of `[]` and a missing `must_mention` would both mean "no required mentions",
 * and keeping two spellings of one fact is how a check ends up asking the wrong
 * question.
 */

import { invalid, ok, type ParseResult } from "@/lib/parse";

/**
 * LinkedIn refuses a post over 3000 characters, so a length band outside that
 * is unenforceable: the creator could not publish a compliant draft even if
 * they wrote one. Not a guess — it is the platform's own limit.
 */
export const LINKEDIN_POST_MAX_CHARS = 3000;

/**
 * A required mention or banned claim longer than this is a paragraph, not a
 * phrase. `draft_check.evidence` has to cite the span it judged, and a span
 * that long tells a creator nothing about what to change.
 */
const MAX_PHRASE_CHARS = 200;

export type LengthBand = {
  readonly min?: number;
  readonly max?: number;
};

export type BriefRequirements = {
  readonly must_mention?: ReadonlyArray<string>;
  readonly must_include_link?: boolean;
  readonly banned_claims?: ReadonlyArray<string>;
  readonly length?: LengthBand;
  readonly requires_disclosure?: boolean;
};

/** True when nothing is required, so every deterministic check passes vacuously. */
export function isVacuous(requirements: BriefRequirements): boolean {
  return Object.keys(requirements).length === 0;
}

/**
 * One phrase per line.
 *
 * Lines rather than commas, because "guaranteed, fastest in the world" is two
 * banned claims and "RFQ turnaround, end to end" is one required mention, and a
 * comma cannot tell them apart.
 */
function parsePhrases(raw: unknown, label: string): ParseResult<string[]> {
  if (raw === null || raw === undefined || raw === "") return ok([]);
  if (typeof raw !== "string") return invalid(`${label} was not text.`);

  const phrases: string[] = [];

  for (const line of raw.split("\n")) {
    const phrase = line.trim();
    if (phrase === "") continue;
    if (phrase.length > MAX_PHRASE_CHARS) {
      return invalid(
        `Each ${label} must be under ${MAX_PHRASE_CHARS} characters — "${phrase.slice(0, 40)}…" is a paragraph, and a check cannot usefully point at one.`,
      );
    }
    // Duplicates would make one rule fire twice against the same draft.
    if (!phrases.includes(phrase)) phrases.push(phrase);
  }

  return ok(phrases);
}

function parseBound(raw: unknown, label: string): ParseResult<number | undefined> {
  if (raw === null || raw === undefined || raw === "") return ok(undefined);
  if (typeof raw !== "string") return invalid(`${label} was not a number.`);

  const trimmed = raw.trim();
  if (trimmed === "") return ok(undefined);
  if (!/^\d+$/.test(trimmed)) {
    return invalid(`${label} must be a whole number of characters.`);
  }

  const value = Number(trimmed);
  if (value > LINKEDIN_POST_MAX_CHARS) {
    return invalid(
      `${label} cannot exceed ${LINKEDIN_POST_MAX_CHARS} characters — LinkedIn will not accept a longer post.`,
    );
  }

  return ok(value);
}

/**
 * The requirements form.
 *
 * A blank form parses to `{}` rather than failing. PRODUCT.md allows a brief to
 * be one line and says the fix for naano's dead end "is not a fix by ceremony";
 * opening the specific form and requiring nothing is a real choice, and the
 * campaign page says so rather than the form refusing to submit.
 */
export function parseRequirementsForm(formData: FormData): ParseResult<BriefRequirements> {
  const mentions = parsePhrases(formData.get("mustMention"), "required mention");
  if (mentions.kind === "invalid") return mentions;

  const banned = parsePhrases(formData.get("bannedClaims"), "banned claim");
  if (banned.kind === "invalid") return banned;

  const min = parseBound(formData.get("lengthMin"), "Minimum length");
  if (min.kind === "invalid") return min;

  const max = parseBound(formData.get("lengthMax"), "Maximum length");
  if (max.kind === "invalid") return max;

  if (min.value !== undefined && max.value !== undefined && min.value > max.value) {
    return invalid("The minimum length is above the maximum, so no draft could pass.");
  }

  const requirements: BriefRequirements = {
    ...(mentions.value.length > 0 ? { must_mention: mentions.value } : {}),
    ...(formData.get("mustIncludeLink") !== null ? { must_include_link: true } : {}),
    ...(banned.value.length > 0 ? { banned_claims: banned.value } : {}),
    ...(min.value !== undefined || max.value !== undefined
      ? {
          length: {
            ...(min.value !== undefined ? { min: min.value } : {}),
            ...(max.value !== undefined ? { max: max.value } : {}),
          },
        }
      : {}),
    ...(formData.get("requiresDisclosure") !== null ? { requires_disclosure: true } : {}),
  };

  return ok(requirements);
}

/**
 * Reading `brief.requirements` back out of jsonb.
 *
 * The column is `jsonb`, which means the database will hand back whatever was
 * put in it — including a shape written by an older version of this file, by
 * the seed, or by hand. Anything unrecognised is dropped rather than rendered,
 * so a malformed stored value cannot become a requirement the UI claims a
 * creator has to satisfy.
 *
 * This drops silently on purpose, and it is the one place in this module that
 * does: the alternative is a campaign page that throws because one key in one
 * row is the wrong type. What it must never do is *invent* a requirement, and
 * dropping cannot.
 */
export function parseStoredRequirements(value: unknown): BriefRequirements {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const raw = value as Record<string, unknown>;

  const phrases = (key: string): ReadonlyArray<string> | undefined => {
    const list = raw[key];
    if (!Array.isArray(list)) return undefined;
    const strings = list.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    return strings.length > 0 ? strings : undefined;
  };

  const flag = (key: string): true | undefined => (raw[key] === true ? true : undefined);

  const bound = (source: Record<string, unknown>, key: string): number | undefined => {
    const found = source[key];
    return typeof found === "number" && Number.isInteger(found) && found >= 0 ? found : undefined;
  };

  const lengthRaw = raw.length;
  const length =
    typeof lengthRaw === "object" && lengthRaw !== null && !Array.isArray(lengthRaw)
      ? (() => {
          const source = lengthRaw as Record<string, unknown>;
          const min = bound(source, "min");
          const max = bound(source, "max");
          if (min === undefined && max === undefined) return undefined;
          // A band that cannot be satisfied is not a requirement, it is a bug in
          // whatever wrote it. Dropping it beats rendering "between 900 and 400".
          if (min !== undefined && max !== undefined && min > max) return undefined;
          return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
        })()
      : undefined;

  const mustMention = phrases("must_mention");
  const bannedClaims = phrases("banned_claims");
  const mustIncludeLink = flag("must_include_link");
  const requiresDisclosure = flag("requires_disclosure");

  return {
    ...(mustMention ? { must_mention: mustMention } : {}),
    ...(mustIncludeLink ? { must_include_link: mustIncludeLink } : {}),
    ...(bannedClaims ? { banned_claims: bannedClaims } : {}),
    ...(length ? { length } : {}),
    ...(requiresDisclosure ? { requires_disclosure: requiresDisclosure } : {}),
  };
}

/** One line per requirement, for rendering the brief back to either side. */
export function describeRequirements(
  requirements: BriefRequirements,
): ReadonlyArray<{ label: string; detail: string }> {
  const lines: Array<{ label: string; detail: string }> = [];

  if (requirements.must_mention) {
    lines.push({
      label: "Must mention",
      detail: requirements.must_mention.map((phrase) => `“${phrase}”`).join(", "),
    });
  }
  if (requirements.must_include_link) {
    lines.push({ label: "Must include", detail: "the tracked link" });
  }
  if (requirements.banned_claims) {
    lines.push({
      label: "Must not claim",
      detail: requirements.banned_claims.map((phrase) => `“${phrase}”`).join(", "),
    });
  }
  if (requirements.length) {
    const { min, max } = requirements.length;
    const detail =
      min !== undefined && max !== undefined
        ? `between ${min} and ${max} characters`
        : min !== undefined
          ? `at least ${min} characters`
          : `at most ${max} characters`;
    lines.push({ label: "Length", detail });
  }
  if (requirements.requires_disclosure) {
    lines.push({ label: "Must carry", detail: "a paid-partnership disclosure" });
  }

  return lines;
}
