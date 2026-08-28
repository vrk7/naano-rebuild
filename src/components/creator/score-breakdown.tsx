import { CONFIDENCE_THRESHOLDS, SCORE_DIMENSIONS } from "@/lib/score/weights";
import { DIMENSION_LABEL, summariseTargets, type TaxonomyLookup } from "@/lib/score/labels";
import { quotableValue, type CreatorScore, type DimensionBreakdown } from "@/lib/score/creator";

/**
 * The working (PRODUCT.md, "Showing the working").
 *
 * One row per scored dimension: what you asked for, how much of this audience
 * is inside it, what that was worth, and what it cost. The `lost` column is the
 * one that answers "why is this 31" — contribution alone tells you where the
 * points came from, not where they went.
 */
export function ScoreBreakdown({
  score,
  taxonomy,
  sampleSize,
  postsAnalyzed,
}: {
  score: CreatorScore;
  taxonomy: TaxonomyLookup;
  sampleSize: number;
  postsAnalyzed: number;
}) {
  /**
   * A withheld score gets no working either.
   *
   * The table is the score in pieces — the points-won column adds up to it — so
   * printing it under a badge that says "Not enough data" hands over the number
   * we just declined to give, one row at a time. PRODUCT.md refuses the score
   * because "a number shown at all is a number that gets quoted", and that holds
   * however the number is spelled.
   */
  if (score.kind === "scored" && quotableValue(score) === null) {
    const t = CONFIDENCE_THRESHOLDS;
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border p-5">
        <p className="text-sm text-pretty">
          There is no score to break down. This creator&rsquo;s latest snapshot covers{" "}
          {sampleSize.toLocaleString()} people across {postsAnalyzed} posts, and a
          score needs at least {t.lowSampleSize} people across {t.lowPostsAnalyzed}{" "}
          posts before it means anything.
        </p>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          The audience below is what we did observe. It is shown with the target set
          marked so you can judge the fit yourself — but a sample this thin cannot
          carry a number, and putting one on it is the failure this scoring exists
          to avoid.
        </p>
      </div>
    );
  }

  if (score.kind === "unscoreable") {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        This ICP has no targets in any dimension, so there is nothing to score against.
        Add roles, seniorities, industries or regions to it and this creator gets a number.
      </p>
    );
  }

  // Presented in the canonical dimension order rather than the order the
  // breakdown happened to be built in, so two creators' tables line up.
  const rows = [...score.breakdown].sort(
    (a, b) => SCORE_DIMENSIONS.indexOf(a.dimension) - SCORE_DIMENSIONS.indexOf(b.dimension),
  );

  const worst = rows.reduce<DimensionBreakdown | null>(
    (acc, row) => (acc === null || row.lost > acc.lost ? row : acc),
    null,
  );

  const totals = rows.reduce(
    (acc, row) => ({ won: acc.won + row.contribution, lost: acc.lost + row.lost }),
    { won: 0, lost: 0 },
  );

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Dimension</th>
            <th className="px-4 py-3 font-medium">You target</th>
            <th className="px-4 py-3 text-right font-medium">Audience inside</th>
            <th className="px-4 py-3 text-right font-medium">Weight</th>
            <th className="px-4 py-3 text-right font-medium">Points won</th>
            <th className="px-4 py-3 text-right font-medium">Points lost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const targets = row.targets.map((t) => taxonomy.labelFor(row.dimension, t));

            return (
              <tr
                key={row.dimension}
                className={row === worst ? "bg-muted/30" : undefined}
                title={row === worst ? "The dimension costing the most points" : undefined}
              >
                <td className="px-4 py-3 font-medium">
                  {DIMENSION_LABEL[row.dimension]}
                  {row === worst ? (
                    <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-normal text-muted-foreground">
                      biggest drag
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground" title={targets.join(", ")}>
                  {summariseTargets(targets)}
                </td>
                <td className="px-4 py-3 text-right">
                  {/* An unobserved dimension is not a zero overlap. The snapshot
                      simply carries no facets for it, which is a gap in what we
                      know rather than a fact about this audience. */}
                  {row.observed ? (
                    <span className="tabular-nums">{Math.round(row.overlap * 100)}%</span>
                  ) : (
                    <span className="text-muted-foreground">not observed</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {Math.round(row.weight * 100)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.contribution.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  −{row.lost.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-border bg-muted/20">
          <tr>
            {/* Totals are the exact column sums, which come to 100.0. The match
                score above is this won column rounded to a whole number, so the
                two differ by up to half a point — showing 100 minus the rounded
                score here instead would leave the column not adding up. */}
            <td className="px-4 py-3 font-medium" colSpan={4}>
              Total, out of 100
            </td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">
              {totals.won.toFixed(1)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
              −{totals.lost.toFixed(1)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
