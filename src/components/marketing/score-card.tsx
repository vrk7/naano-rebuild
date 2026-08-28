import { cn } from "@/lib/utils";
import { ScoreRing } from "./score-ring";

export type Dimension = {
  label: string;
  /** Share of the creator's audience that falls inside the ICP targets, 0-1. */
  overlap: number;
};

type ScoreCardProps = {
  creator: string;
  audience: string;
  value: number | null;
  confidence: "low" | "medium" | "high";
  dimensions: Dimension[];
  /** The single largest thing dragging the score down, in words. */
  detractor: string;
  className?: string;
};

const CONFIDENCE_LABEL = {
  low: "Not enough data",
  medium: "Medium confidence",
  high: "High confidence",
} as const;

/** One creator, scored against one ICP, with the working shown. */
export function ScoreCard({
  creator,
  audience,
  value,
  confidence,
  dimensions,
  detractor,
  className,
}: ScoreCardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-[0_18px_50px_-24px_oklch(0.2_0.05_259/0.45)]",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <ScoreRing value={value} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{creator}</p>
          <p className="truncate text-xs text-muted-foreground">{audience}</p>
          <span
            className={cn(
              "mt-2 inline-flex rounded-full px-2 py-0.5 text-2xs font-medium",
              confidence === "low"
                ? "bg-muted text-muted-foreground"
                : "bg-brand-soft text-brand",
            )}
          >
            {CONFIDENCE_LABEL[confidence]}
          </span>
        </div>
      </div>

      <dl className="mt-4 space-y-2">
        {dimensions.map((dimension, index) => (
          <div key={dimension.label} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
            <dt className="text-2xs text-muted-foreground">{dimension.label}</dt>
            <dd className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="meter-fill block h-full rounded-full bg-brand"
                style={{
                  width: `${Math.round(dimension.overlap * 100)}%`,
                  animationDelay: `${0.45 + index * 0.12}s`,
                }}
              />
            </dd>
            <dd className="text-right text-2xs tabular-nums text-muted-foreground">
              {Math.round(dimension.overlap * 100)}%
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-border pt-3 text-xs text-pretty text-muted-foreground">
        {detractor}
      </p>
    </article>
  );
}
