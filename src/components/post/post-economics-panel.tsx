import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricLine } from "@/components/ui/metric";
import { formatCents, formatPercent } from "@/lib/posts/metrics";
import type { PostEconomics } from "@/lib/posts/metrics";

/**
 * The three numbers PRODUCT.md step 13 asks for. Cost per ICP-matched person is
 * emphasised because it is the one that separates reach from pipeline, and it
 * is deliberately allowed to be absent: an em dash means the post engaged
 * people and none of them were the ones this brand asked for.
 *
 * This block is the one place on the page that spends the accent. Every other
 * figure here is neutral, which is what makes this one read as the answer
 * rather than as a fourth statistic.
 */
export function PostEconomicsPanel({ economics }: { economics: PostEconomics }) {
  const rows = [
    { label: "Cost of the post", value: formatCents(economics.costCents) },
    { label: "Per engaged person", value: formatCents(economics.costPerEngagedCents) },
  ];

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>What it cost</CardTitle>
      </CardHeader>

      <CardBody>
        <dl className="space-y-2">
          {rows.map((row) => (
            <MetricLine key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>

        <div className="mt-3 rounded-md border border-brand/20 bg-brand-soft px-3 py-2.5">
          <dt className="eyebrow text-brand/80">Per ICP-matched person</dt>
          <dd className="num mt-0.5 text-3xl font-semibold tracking-[-0.02em] tabular-nums text-brand">
            {formatCents(economics.costPerMatchedCents)}
          </dd>
          <p className="mt-1 text-xs text-pretty text-muted-foreground">
            {economics.matchedPeople === 0
              ? `None of the ${economics.engagedPeople} people who engaged matched an active ICP.`
              : `${economics.matchedPeople} of ${economics.engagedPeople} engaged people (${formatPercent(economics.matchRate)}).`}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
