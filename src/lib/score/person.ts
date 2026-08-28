import { DIMENSION_WEIGHTS, SCORE_DIMENSIONS, type ScoreDimension } from "./weights.ts";

/**
 * Person-level ICP matching, the counterpart to scoreCreator in ./creator.ts.
 *
 * A creator is scored against a distribution — what share of their audience
 * falls inside each target set. A person is a single point, so each dimension
 * either matches or it does not. Same weights, same renormalisation, different
 * shape of input.
 */

/**
 * Scores a single person against a set of ICP targets.
 *
 * A person is a point, not a distribution, so each dimension's overlap is 1 or
 * 0 rather than a share. A dimension with no targets is dropped and the
 * remaining weights renormalised, so an ICP that only specifies roles and geos
 * still scores (PRODUCT.md, "Match score").
 */
export function scorePerson(
  person: Readonly<Record<ScoreDimension, string>>,
  targets: Readonly<Partial<Record<ScoreDimension, ReadonlyArray<string>>>>,
): { value: number; matched: ScoreDimension[] } {
  const active = SCORE_DIMENSIONS.filter((d) => (targets[d]?.length ?? 0) > 0);
  if (active.length === 0) return { value: 0, matched: [] };

  const totalWeight = active.reduce((sum, d) => sum + DIMENSION_WEIGHTS[d], 0);
  const matched = active.filter((d) => targets[d]!.includes(person[d]));
  const earned = matched.reduce((sum, d) => sum + DIMENSION_WEIGHTS[d], 0);

  return { value: Math.round((earned / totalWeight) * 100), matched };
}
