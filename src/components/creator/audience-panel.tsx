import { cn } from "@/lib/utils";
import { SCORE_DIMENSIONS, type ScoreDimension } from "@/lib/score/weights";
import { DIMENSION_LABEL, type TaxonomyLookup } from "@/lib/score/labels";
import type { AudienceFacet, IcpTarget } from "@/lib/score/creator";

/**
 * The audience itself, with the ICP's target set marked (PRODUCT.md step 6).
 *
 * This is the panel that has to agree with the score. naano's failure was an
 * audience breakdown sitting one click from a 100% match it flatly contradicts:
 * 43% India, 24% Pakistan, against a brand selling into European manufacturing.
 * Highlighting exactly the rows the score counted is what makes the two
 * checkable against each other.
 */
export function AudiencePanel({
  facets,
  targets,
  taxonomy,
  showOverlap = true,
}: {
  facets: ReadonlyArray<AudienceFacet>;
  targets: ReadonlyArray<IcpTarget>;
  taxonomy: TaxonomyLookup;
  /**
   * False when the score was withheld. The per-dimension "x% inside your
   * targets" figure is overlap(d) — a term of the score — so it is suppressed
   * alongside it. The observed shares stay: they are the evidence, they carry
   * their sample size in the header, and hiding them would leave nothing to
   * judge.
   */
  showOverlap?: boolean;
}) {
  const targetsByDimension = new Map<ScoreDimension, Set<string>>();
  for (const target of targets) {
    const existing = targetsByDimension.get(target.dimension) ?? new Set<string>();
    existing.add(target.value);
    targetsByDimension.set(target.dimension, existing);
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {SCORE_DIMENSIONS.map((dimension) => (
        <DimensionCard
          key={dimension}
          dimension={dimension}
          facets={facets.filter((f) => f.dimension === dimension)}
          targets={targetsByDimension.get(dimension) ?? new Set()}
          taxonomy={taxonomy}
          showOverlap={showOverlap}
        />
      ))}
    </div>
  );
}

function DimensionCard({
  dimension,
  facets,
  targets,
  taxonomy,
  showOverlap,
}: {
  dimension: ScoreDimension;
  facets: ReadonlyArray<AudienceFacet>;
  targets: ReadonlySet<string>;
  taxonomy: TaxonomyLookup;
  showOverlap: boolean;
}) {
  const rows = [...facets].sort((a, b) => b.share - a.share);
  const inside = rows
    .filter((row) => targets.has(row.value))
    .reduce((sum, row) => sum + row.share, 0);

  // Targets the audience has none of. The score already counts them as zero;
  // naming them turns "your industry overlap is 4%" into "you asked for
  // industrial equipment and this audience contains none of it".
  const absent = [...targets].filter((value) => !rows.some((row) => row.value === value));

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{DIMENSION_LABEL[dimension]}</h3>
        {targets.size === 0 ? (
          <span className="text-xs text-muted-foreground">not targeted</span>
        ) : showOverlap ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(inside * 100)}% inside your targets
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing observed for this dimension in the latest snapshot.
        </p>
      ) : (
        <dl className="mt-3 space-y-1.5">
          {rows.map((row) => {
            const isTargeted = targets.has(row.value);
            return (
              <div
                key={row.value}
                className="grid grid-cols-[minmax(0,1fr)_4rem_2.75rem] items-center gap-2"
              >
                <dt
                  className={cn(
                    "truncate text-xs",
                    isTargeted ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                  title={taxonomy.labelFor(dimension, row.value)}
                >
                  {taxonomy.labelFor(dimension, row.value)}
                </dt>
                <dd className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      isTargeted ? "bg-brand" : "bg-muted-foreground/35",
                    )}
                    style={{ width: `${Math.max(row.share * 100, 1.5)}%` }}
                  />
                </dd>
                <dd
                  className={cn(
                    "text-right text-xs tabular-nums",
                    isTargeted ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatShare(row.share)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {absent.length > 0 ? (
        <p className="mt-3 border-t border-border pt-2 text-xs text-pretty text-muted-foreground">
          No audience at all in:{" "}
          {absent.map((value) => taxonomy.labelFor(dimension, value)).join(", ")}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Shares below half a percent round to "0%", which reads as absent when the row
 * is right there showing otherwise. Those get "<1%" instead.
 */
function formatShare(share: number): string {
  const percent = share * 100;
  if (percent > 0 && percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}
