import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { quotableValue, type CreatorScore } from "@/lib/score/creator";
import { scoreBand } from "@/lib/marketplace/ranking";

/**
 * The bar under the figure carries the band. The figure itself is always plain
 * foreground.
 *
 * This replaces a tinted tile per band. Two reasons the meter is better than
 * the fill it replaces: a 31 and a 94 now differ by bar *length* as well as by
 * digits, so the band is legible without reading the number or decoding a
 * colour; and the number stops being printed on a coloured ground, which is
 * what was costing it contrast in the two weakest bands.
 *
 * The accent appears only on `strong`. A weak score is drawn quiet, never red —
 * it is an accurate answer, not a fault.
 */
const BAND_METER = {
  strong: "bg-brand",
  partial: "bg-foreground/45",
  weak: "bg-foreground/20",
  withheld: "bg-transparent",
} as const;

const CONFIDENCE_NOTE = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Not enough data",
} as const;

/**
 * The score, or an explicit refusal to give one.
 *
 * A `low`-confidence creator gets the words, never a greyed-out number:
 * PRODUCT.md is explicit that "a number shown at all is a number that gets
 * quoted". A weak score, by contrast, is shown in full and only styled down —
 * hiding it would rebuild the score that cannot say no.
 */
export function ScoreBadge({
  score,
  size = "default",
  className,
}: {
  score: CreatorScore;
  size?: "default" | "large";
  className?: string;
}) {
  const value = quotableValue(score);
  const band = scoreBand(score);
  const isLarge = size === "large";

  if (value === null) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-md border border-dashed border-border px-1.5 text-center",
          isLarge ? "size-24" : "size-16",
          className,
        )}
      >
        <span
          className={cn(
            "font-medium leading-tight text-balance text-muted-foreground",
            isLarge ? "text-xs" : "text-2xs",
          )}
        >
          {score.kind === "unscoreable" ? "No ICP targets" : "Not enough data"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-border",
        isLarge ? "size-24 gap-1 px-3" : "size-16 gap-0.5 px-2",
        className,
      )}
    >
      <span
        className={cn(
          "num font-semibold tabular-nums tracking-[-0.02em]",
          isLarge ? "text-4xl" : "text-2xl",
        )}
      >
        {value}
      </span>
      <span className="text-2xs leading-none text-muted-foreground">/ 100</span>

      {/* Magnitude, drawn. `aria-hidden` because the figure above already says
          it — a screen reader does not need the number twice. */}
      <span
        aria-hidden
        className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn("block h-full rounded-full", BAND_METER[band])}
          style={{ width: `${value}%` }}
        />
      </span>
    </div>
  );
}

/** The confidence label, always shown, including next to a number we do print. */
export function ConfidenceNote({
  score,
  className,
}: {
  score: CreatorScore;
  className?: string;
}) {
  return (
    <Badge
      variant={score.confidence === "low" ? "outline" : "neutral"}
      className={className}
    >
      {CONFIDENCE_NOTE[score.confidence]}
    </Badge>
  );
}
