/**
 * The scoring constants, in one place.
 *
 * PRODUCT.md is blunt about these: "These four numbers are a guess. Nothing was
 * measured. They encode an opinion — that who the audience is matters slightly
 * more than where it is — and they are wrong in some way we cannot yet name.
 * They live in one constant and get calibrated once there is a single campaign
 * with real outcomes to calibrate against."
 *
 * This file is that one constant. The marketplace scorer, the person-level ICP
 * match and the seed all read it, so calibrating means editing one number here
 * and nothing else.
 */

export type ScoreDimension = "job_function" | "seniority" | "industry" | "geo";

export const DIMENSION_WEIGHTS: Readonly<Record<ScoreDimension, number>> = {
  job_function: 0.3,
  industry: 0.25,
  geo: 0.25,
  seniority: 0.2,
};

export const SCORE_DIMENSIONS: ReadonlyArray<ScoreDimension> = [
  "job_function",
  "seniority",
  "industry",
  "geo",
];

/**
 * Confidence thresholds. Also a guess, anchored on one real observation: naano
 * prints a confident number off 49 engagers and 5 posts. These sit above that
 * so the failure being corrected cannot be reproduced.
 */
export const CONFIDENCE_THRESHOLDS = {
  lowSampleSize: 100,
  lowPostsAnalyzed: 10,
  mediumSampleSize: 400,
  mediumPostsAnalyzed: 25,
} as const;

export type Confidence = "low" | "medium" | "high";

/**
 * The score at or above which a person counts as matching an ICP.
 *
 * Not an arbitrary round number. With the weights above there is a gap in the
 * achievable scores: the best a person can do on two dimensions is 55
 * (job_function + industry, or job_function + geo) and the worst they can do on
 * three is 70 (industry + geo + seniority). Nothing lands in between. Any
 * threshold in that gap therefore means exactly one thing — "matched at least
 * three of the four dimensions" — and 60 sits in it.
 *
 * The alternative, 50, lets two dimensions carry a match. On the seeded demo
 * that made 99% of engagers on a well-targeted post count as matched, which is
 * the score-that-cannot-say-no this product exists to correct.
 *
 * The gap only holds while an ICP specifies all four dimensions; with fewer,
 * weights renormalise and the boundary moves. Matches below the threshold are
 * still stored with their score — this is the threshold for counting, not for
 * computing.
 */
export const ICP_MATCH_THRESHOLD = 60;

export function confidenceFor(sampleSize: number, postsAnalyzed: number): Confidence {
  const t = CONFIDENCE_THRESHOLDS;
  if (sampleSize < t.lowSampleSize || postsAnalyzed < t.lowPostsAnalyzed) return "low";
  if (sampleSize < t.mediumSampleSize || postsAnalyzed < t.mediumPostsAnalyzed) {
    return "medium";
  }
  return "high";
}

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
