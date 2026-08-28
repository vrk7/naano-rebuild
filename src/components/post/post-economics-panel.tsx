import { formatCents, formatPercent } from "@/lib/posts/metrics";
import type { PostEconomics } from "@/lib/posts/metrics";

/**
 * The three numbers PRODUCT.md step 13 asks for. Cost per ICP-matched person is
 * emphasised because it is the one that separates reach from pipeline, and it
 * is deliberately allowed to be absent: an em dash means the post engaged
 * people and none of them were the ones this brand asked for.
 */
export function PostEconomicsPanel({ economics }: { economics: PostEconomics }) {
  const rows = [
    { label: "Cost of the post", value: formatCents(economics.costCents) },
    { label: "Per engaged person", value: formatCents(economics.costPerEngagedCents) },
  ];

  return (
    <aside className="rounded-lg border border-border p-5">
      <h2 className="text-sm font-medium">What it cost</h2>

      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-md bg-brand-soft p-4">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Per ICP-matched person
        </dt>
        <dd className="mt-1 text-2xl font-semibold tabular-nums">
          {formatCents(economics.costPerMatchedCents)}
        </dd>
        <p className="mt-1 text-xs text-muted-foreground">
          {economics.matchedPeople === 0
            ? `None of the ${economics.engagedPeople} people who engaged matched an active ICP.`
            : `${economics.matchedPeople} of ${economics.engagedPeople} engaged people (${formatPercent(economics.matchRate)}).`}
        </p>
      </div>
    </aside>
  );
}
