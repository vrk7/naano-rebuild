import { cn } from "@/lib/utils";
import { quotableValue, type CreatorScore } from "@/lib/score/creator";
import { scoreBand } from "@/lib/marketplace/ranking";

const BAND_STYLE = {
  strong: "border-brand/30 bg-brand-soft text-brand",
  partial: "border-border bg-muted/60 text-foreground",
  weak: "border-border bg-muted/40 text-muted-foreground",
  withheld: "border-dashed border-border bg-transparent text-muted-foreground",
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

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border text-center",
        BAND_STYLE[band],
        size === "large" ? "size-24 gap-0.5" : "size-16 gap-0.5",
        className,
      )}
    >
      {value === null ? (
        <span
          className={cn(
            "px-1.5 font-medium leading-tight text-balance",
            size === "large" ? "text-xs" : "text-[0.62rem]",
          )}
        >
          {score.kind === "unscoreable" ? "No ICP targets" : "Not enough data"}
        </span>
      ) : (
        <>
          <span
            className={cn(
              "font-semibold tabular-nums",
              size === "large" ? "text-3xl" : "text-xl",
            )}
          >
            {value}
          </span>
          <span
            className={cn(
              "leading-none opacity-70",
              size === "large" ? "text-[0.65rem]" : "text-[0.55rem]",
            )}
          >
            / 100
          </span>
        </>
      )}
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
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
        score.confidence === "low"
          ? "bg-muted text-muted-foreground"
          : "bg-muted/60 text-muted-foreground",
        className,
      )}
    >
      {CONFIDENCE_NOTE[score.confidence]}
    </span>
  );
}
