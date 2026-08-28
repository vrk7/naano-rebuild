/**
 * Parsing the ICP editor (PRODUCT.md step 3).
 *
 * "The screen naano has, with one difference: the targets are editable chips,
 * not prose." The difference is the whole enabling change — you cannot score
 * against a paragraph — which makes this form the thing every match score in
 * the workspace is computed from. It is untrusted input like any other: the
 * chips are checkboxes, and a submitted value that is not in the vocabulary
 * would become an `icp_target` row that joins to no audience facet, ever.
 *
 * Pure, so all of that is testable without a request.
 */

import { invalid, ok, type ParseResult } from "@/lib/parse";
import { SCORE_DIMENSIONS, type ScoreDimension } from "@/lib/score/weights";
import { isKnownTargetValue, type IcpTargets, type Vocabulary } from "./intelligence";

const MAX_LABEL = 120;
const MAX_DESCRIPTION = 1000;

/** PRODUCT.md ranks 1..3, and `icp.rank` has a check constraint saying so. */
export const MIN_RANK = 1;
export const MAX_RANK = 3;

export type IcpEdit = {
  /** Null creates a new ICP at this rank. */
  readonly id: string | null;
  readonly rank: number;
  readonly label: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly targets: IcpTargets;
};

function parseText(
  raw: FormDataEntryValue | null,
  label: string,
  max: number,
  required: boolean,
): ParseResult<string> {
  if (typeof raw !== "string") return required ? invalid(`${label} is required.`) : ok("");

  const trimmed = raw.trim();
  if (trimmed === "") return required ? invalid(`${label} is required.`) : ok("");
  if (trimmed.length > max) return invalid(`${label} must be under ${max} characters.`);

  return ok(trimmed);
}

export function parseIcpForm(
  formData: FormData,
  vocabulary: Vocabulary,
): ParseResult<IcpEdit> {
  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId.trim() !== "" ? rawId.trim() : null;

  const rank = Number(formData.get("rank"));
  if (!Number.isInteger(rank) || rank < MIN_RANK || rank > MAX_RANK) {
    return invalid(`An ICP is ranked ${MIN_RANK} to ${MAX_RANK}.`);
  }

  const label = parseText(formData.get("label"), "A name for this ICP", MAX_LABEL, true);
  if (label.kind === "invalid") return label;

  // The paragraph is read by a human and fed to brief generation. Nothing
  // scores against it, so an empty one is a poorer ICP, not an invalid one.
  const description = parseText(
    formData.get("description"),
    "The description",
    MAX_DESCRIPTION,
    false,
  );
  if (description.kind === "invalid") return description;

  const targets: Record<ScoreDimension, string[]> = {
    job_function: [],
    seniority: [],
    industry: [],
    geo: [],
  };

  for (const dimension of SCORE_DIMENSIONS) {
    for (const entry of formData.getAll(dimension)) {
      if (typeof entry !== "string") {
        return invalid(`Something other than a value was submitted for ${dimension}.`);
      }
      if (!isKnownTargetValue(dimension, entry, vocabulary)) {
        // Not reachable by clicking: every chip renders a value from the
        // vocabulary. Reaching it means the form was submitted by something
        // else, and a target the score can never match is worth refusing
        // rather than storing.
        return invalid(`"${entry}" is not something ${dimension} can target.`);
      }
      if (!targets[dimension].includes(entry)) targets[dimension].push(entry);
    }
  }

  /*
   * An ICP with no targets is unscoreable — the marketplace says so rather than
   * ranking against it. Allowed on the way to a saved one, because a brand
   * clearing a dimension to redo it should not be blocked mid-edit, and the
   * screen says what it currently means.
   */
  return ok({
    id,
    rank,
    label: label.value,
    description: description.value,
    // An unchecked box is absent from the submission.
    isActive: formData.get("is_active") === "on",
    targets,
  });
}
