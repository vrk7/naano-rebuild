/**
 * Parsing the campaign screen (PRODUCT.md step 4).
 *
 * Name, objective, geos, then the brief: `specific` opens the requirements
 * form, `creative_freedom` takes a single line of body text and moves on. Both
 * are real modes — SCOPE.md is explicit that "`creative_freedom` is a real
 * mode, not a disabled radio", which is the escape hatch naano promises in a
 * toast (`brand/37`) and then does not offer in its own offer form (`brand/14`).
 *
 * Pure. The whole screen parses before anything is written, so a campaign is
 * never created with a brief that turns out to be invalid.
 */

import { invalid, ok, type ParseResult } from "@/lib/parse";
import { isSupportedRegion } from "@/lib/geo/regions";
import { parseRequirementsForm, type BriefRequirements } from "./requirements";

export const BRIEF_MODES = ["specific", "creative_freedom"] as const;
export type BriefMode = (typeof BRIEF_MODES)[number];

export function isBriefMode(value: unknown): value is BriefMode {
  return typeof value === "string" && (BRIEF_MODES as ReadonlyArray<string>).includes(value);
}

/** `campaign.name` is text, but a name nobody can read in a list is not a name. */
const MAX_NAME_CHARS = 120;
const MAX_OBJECTIVE_CHARS = 500;

/**
 * `brief.body` is what a creator actually reads before writing. The ceiling is
 * generous because a specific brief can be long; the floor is one character,
 * since PRODUCT.md allows a one-line brief on purpose.
 */
const MAX_BODY_CHARS = 4000;

export type CampaignInput = {
  readonly name: string;
  readonly objective: string | null;
  readonly geos: ReadonlyArray<string>;
  readonly brief: {
    readonly mode: BriefMode;
    readonly body: string;
    readonly requirements: BriefRequirements;
  };
};

function parseText(
  raw: unknown,
  { label, max, required }: { label: string; max: number; required: boolean },
): ParseResult<string> {
  if (typeof raw !== "string") {
    return required ? invalid(`${label} is required.`) : ok("");
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return required ? invalid(`${label} is required.`) : ok("");
  }
  if (trimmed.length > max) {
    return invalid(`${label} must be under ${max} characters.`);
  }

  return ok(trimmed);
}

/**
 * Target regions, as ISO-3166 alpha-2.
 *
 * An empty list is allowed and means no geographic restriction, which is a real
 * campaign rather than an unfinished one. Codes outside the supported set are
 * rejected rather than stored: `campaign.geos` is `text[]` with no constraint
 * behind it, so this is the only thing standing between a typo and a filter
 * that silently matches nothing.
 */
export function parseGeos(raw: ReadonlyArray<FormDataEntryValue>): ParseResult<string[]> {
  const geos: string[] = [];

  for (const entry of raw) {
    if (typeof entry !== "string" || !isSupportedRegion(entry)) {
      return invalid("One of those regions was not recognised.");
    }
    if (!geos.includes(entry)) geos.push(entry);
  }

  return ok(geos);
}

export function parseCampaignForm(formData: FormData): ParseResult<CampaignInput> {
  const name = parseText(formData.get("name"), {
    label: "Campaign name",
    max: MAX_NAME_CHARS,
    required: true,
  });
  if (name.kind === "invalid") return name;

  const objective = parseText(formData.get("objective"), {
    label: "Objective",
    max: MAX_OBJECTIVE_CHARS,
    required: false,
  });
  if (objective.kind === "invalid") return objective;

  const geos = parseGeos(formData.getAll("geos"));
  if (geos.kind === "invalid") return geos;

  const rawMode = formData.get("mode");
  if (!isBriefMode(rawMode)) {
    return invalid("Pick a brief mode.");
  }

  const body = parseText(formData.get("body"), {
    label: rawMode === "creative_freedom" ? "Your one line" : "Brief",
    max: MAX_BODY_CHARS,
    required: true,
  });
  if (body.kind === "invalid") return body;

  /*
   * creative_freedom means `{}`, and it means it whatever the requirements
   * fields happen to contain. The form hides them in that mode, but a hidden
   * field is not an absent one — reading them here would let a stale value from
   * a mode the user switched away from become a rule the creator is judged on.
   */
  const requirements =
    rawMode === "creative_freedom" ? ok<BriefRequirements>({}) : parseRequirementsForm(formData);
  if (requirements.kind === "invalid") return requirements;

  return ok({
    name: name.value,
    objective: objective.value === "" ? null : objective.value,
    geos: geos.value,
    brief: { mode: rawMode, body: body.value, requirements: requirements.value },
  });
}
