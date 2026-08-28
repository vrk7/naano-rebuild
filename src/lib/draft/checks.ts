/**
 * The deterministic draft checks (PRODUCT.md step 9).
 *
 * Every rule reads `brief.requirements` and judges one thing about one draft.
 * SCOPE.md cuts the model-judged half of this for v1 and says why: "An LLM
 * scoring 'brief adherence' produces a number nobody can dispute or act on, and
 * it is the least differentiated thing we could build." What is left are the
 * failures that actually recur — a missing mention, a missing link, a length
 * band, a banned claim, an absent disclosure — and each one either points at the
 * span it judged or names exactly what it looked for and did not find.
 *
 * Pure, and tested. These decide whether somebody's writing passes, and the
 * creator sees the result before the brand does, so a check that fires wrongly
 * costs a person a rewrite they did not need.
 */

import type { BriefRequirements } from "@/lib/campaign/requirements";

export type CheckStatus = "pass" | "fail" | "warn";

export type DraftCheck = {
  readonly ruleKey: string;
  readonly ruleLabel: string;
  /** `model` exists for the half SCOPE.md defers behind `DraftReviewer`. */
  readonly kind: "deterministic";
  readonly status: CheckStatus;
  /**
   * The span of the draft this judgement is about, or null when the finding is
   * an absence — nothing to quote is the honest answer to "where is the link
   * you did not include", and quoting the opening line instead would be
   * evidence for a claim it is not evidence for.
   */
  readonly evidence: string | null;
  readonly explanation: string;
};

/**
 * How much of the draft to quote around a match.
 *
 * Enough to recognise where in the post it sits, short enough to read in a
 * table cell. A guess, with nothing measured behind it.
 */
const EVIDENCE_CONTEXT = 45;

/**
 * The disclosure markers this check recognises.
 *
 * A judgement call rather than a legal standard: these are the forms that read
 * unambiguously as "this is paid" on LinkedIn. A creator who discloses some
 * other way fails a check they should not, which is why the explanation lists
 * what would pass rather than only saying no.
 */
const DISCLOSURE_MARKERS: ReadonlyArray<string> = [
  "#ad",
  "#sponsored",
  "#paidpartnership",
  "#paidpromotion",
  "paid partnership",
  "paid promotion",
  "sponsored post",
];

/**
 * A link, as LinkedIn would treat one: an explicit scheme, or a bare host that
 * the platform turns into a link on publish.
 */
const LINK_PATTERN = /\bhttps?:\/\/[^\s<>()]+|\bwww\.[^\s<>()]+\.[^\s<>()]+/i;

/**
 * Whitespace is collapsed before anything is searched.
 *
 * A creator writing "RFQ\nturnaround" across a line break has written the
 * phrase; a check that says otherwise is asking about formatting, not about the
 * brief. Spans are quoted from the collapsed text for the same reason.
 */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The span around a match, with ellipses where the draft continues. */
function excerpt(haystack: string, at: number, length: number): string {
  const from = Math.max(0, at - EVIDENCE_CONTEXT);
  const to = Math.min(haystack.length, at + length + EVIDENCE_CONTEXT);
  return `${from > 0 ? "…" : ""}${haystack.slice(from, to)}${to < haystack.length ? "…" : ""}`;
}

function find(haystack: string, needle: string): { at: number; length: number } | null {
  const at = haystack.toLowerCase().indexOf(needle.toLowerCase());
  return at === -1 ? null : { at, length: needle.length };
}

function mentionChecks(body: string, phrases: ReadonlyArray<string>): DraftCheck[] {
  return phrases.map((phrase) => {
    const hit = find(body, phrase);
    return {
      ruleKey: "must_mention",
      ruleLabel: `Mentions “${phrase}”`,
      kind: "deterministic" as const,
      status: hit ? ("pass" as const) : ("fail" as const),
      evidence: hit ? excerpt(body, hit.at, hit.length) : null,
      explanation: hit
        ? `Found “${phrase}”.`
        : `The brief requires the phrase “${phrase}”, and it does not appear in this draft.`,
    };
  });
}

function bannedChecks(body: string, phrases: ReadonlyArray<string>): DraftCheck[] {
  return phrases.map((phrase) => {
    const hit = find(body, phrase);
    return {
      ruleKey: "banned_claims",
      ruleLabel: `Avoids “${phrase}”`,
      kind: "deterministic" as const,
      status: hit ? ("fail" as const) : ("pass" as const),
      // The one rule that always has a span when it fails: the claim is there,
      // in the draft, and this is where.
      evidence: hit ? excerpt(body, hit.at, hit.length) : null,
      explanation: hit
        ? `The brief bans “${phrase}”, and it appears here.`
        : `“${phrase}” does not appear.`,
    };
  });
}

function linkCheck(body: string): DraftCheck {
  const match = LINK_PATTERN.exec(body);
  return {
    ruleKey: "must_include_link",
    ruleLabel: "Includes a link",
    kind: "deterministic",
    status: match ? "pass" : "fail",
    evidence: match ? excerpt(body, match.index, match[0].length) : null,
    explanation: match
      ? `Links to ${match[0]}.`
      : "The brief requires a link, and this draft contains none.",
  };
}

function lengthCheck(body: string, band: { min?: number; max?: number }): DraftCheck {
  const length = body.length;
  const { min, max } = band;

  const tooShort = min !== undefined && length < min;
  const tooLong = max !== undefined && length > max;

  const wanted =
    min !== undefined && max !== undefined
      ? `between ${min} and ${max} characters`
      : min !== undefined
        ? `at least ${min} characters`
        : `at most ${max} characters`;

  return {
    ruleKey: "length",
    ruleLabel: `Runs ${wanted}`,
    kind: "deterministic",
    status: tooShort || tooLong ? "fail" : "pass",
    // The span judged is the whole draft, so quoting part of it would be
    // quoting the wrong thing. The count is the finding.
    evidence: null,
    explanation: `${length.toLocaleString()} characters; the brief asks for ${wanted}.`,
  };
}

function disclosureCheck(body: string): DraftCheck {
  const found = DISCLOSURE_MARKERS.map((marker) => find(body, marker))
    .map((hit, index) => (hit ? { hit, marker: DISCLOSURE_MARKERS[index] } : null))
    .find((entry) => entry !== null);

  return {
    ruleKey: "requires_disclosure",
    ruleLabel: "Discloses the partnership",
    kind: "deterministic",
    status: found ? "pass" : "fail",
    evidence: found ? excerpt(body, found.hit.at, found.hit.length) : null,
    explanation: found
      ? `Discloses with “${found.marker}”.`
      : `The brief requires disclosure. Any of ${DISCLOSURE_MARKERS.map((m) => `“${m}”`).join(", ")} would satisfy it.`,
  };
}

/**
 * Every rule the brief actually sets, run against one draft.
 *
 * An empty result means the brief required nothing — `creative_freedom` stores
 * `{}` and PRODUCT.md says those checks "all pass vacuously". It never means a
 * check could not be run: every rule present in `requirements` produces exactly
 * one row per phrase, pass or fail.
 *
 * No rule returns `warn` yet. The deterministic ones are yes-or-no by
 * construction; `warn` is there for the model half SCOPE.md defers.
 */
export function runDeterministicChecks(
  rawBody: string,
  requirements: BriefRequirements,
): DraftCheck[] {
  const body = collapse(rawBody);

  return [
    ...mentionChecks(body, requirements.must_mention ?? []),
    ...(requirements.must_include_link ? [linkCheck(body)] : []),
    ...bannedChecks(body, requirements.banned_claims ?? []),
    ...(requirements.length ? [lengthCheck(body, requirements.length)] : []),
    ...(requirements.requires_disclosure ? [disclosureCheck(body)] : []),
  ];
}

export function failures(checks: ReadonlyArray<DraftCheck>): DraftCheck[] {
  return checks.filter((check) => check.status === "fail");
}
