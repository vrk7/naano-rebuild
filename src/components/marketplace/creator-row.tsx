import Link from "next/link";

import { ConfidenceNote, ScoreBadge } from "./score-badge";
import { formatCents } from "@/lib/posts/metrics";
import { quotableValue, type CreatorScore } from "@/lib/score/creator";
import type { RankedCreator } from "@/lib/marketplace/ranking";
import type { TaxonomyLookup } from "@/lib/score/labels";

/**
 * One creator in the list.
 *
 * Carries three things naano's own cards do not: a score that varies, the
 * confidence behind it, and the single largest reason it is not higher
 * (PRODUCT.md step 5). The detractor sentence is the row's whole argument — a
 * brand should be able to skip a creator without opening them, and open the
 * ones where the sentence is surprising.
 */
export function CreatorRow({
  entry,
  taxonomy,
}: {
  entry: RankedCreator;
  taxonomy: TaxonomyLookup;
}) {
  const { creator, best } = entry;
  const country = creator.country ? taxonomy.labelFor("geo", creator.country) : null;

  return (
    <li>
      <Link
        href={`/brand/creators/${creator.id}`}
        className="flex gap-5 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40 sm:p-5"
      >
        <ScoreBadge score={best.score} className="shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium">{creator.displayName}</span>
            <span className="text-xs text-muted-foreground">
              {creator.followers.toLocaleString()} followers
              {country ? ` · ${country}` : ""}
              {creator.priceCents !== null ? ` · ${formatCents(creator.priceCents)} per post` : ""}
            </span>
          </div>

          {creator.headline ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{creator.headline}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ConfidenceNote score={best.score} />
            {/* Which ICP the number belongs to. A score with no stated question
                behind it is the constant we are replacing — and by the same
                logic, a withheld score names no ICP, because none of them was
                answered. */}
            {quotableValue(best.score) !== null ? (
              <span className="text-xs text-muted-foreground">vs. {best.icp.label}</span>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            {rowVerdict(best.score, creator.sampleSize, creator.postsAnalyzed)}
          </p>
        </div>
      </Link>
    </li>
  );
}

/**
 * What the row says underneath the number.
 *
 * Four cases, kept distinct. The one that matters is `low`: a thin sample gets
 * the sample size, never the detractor percentage. "96% of this audience is
 * outside your target regions" computed off 40 people is the same confident
 * number off 49 engagers that PRODUCT.md opens by refusing, and putting it in
 * prose instead of in the badge would not make it any more measured.
 */
function rowVerdict(
  score: CreatorScore,
  sampleSize: number,
  postsAnalyzed: number,
): string {
  const measured = `${sampleSize.toLocaleString()} people across ${postsAnalyzed} posts`;

  if (score.kind === "unscoreable") {
    return "This ICP has no targets set, so there is nothing to score against.";
  }
  if (score.confidence === "low") {
    return `Only ${measured} observed — too thin to put a number on.`;
  }
  if (score.largestDetractor === null) {
    return `Every dimension of this audience falls inside your targets. Measured on ${measured}.`;
  }
  return `${score.largestDetractor}. Measured on ${measured}.`;
}
