import { cn } from "@/lib/utils";

/** Above this a match reads as strong; below it the ring stays neutral grey. */
const STRONG_MATCH = 65;

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const VIEWBOX = 64;

type ScoreRingProps = {
  /** 0-100, or null when the sample is too small to answer. */
  value: number | null;
  className?: string;
  /** Delay in seconds before the arc draws, for staggering. */
  delaySeconds?: number;
};

/**
 * The match score, drawn as it would be on a marketplace card. A null value is
 * an explicit refusal to answer, not a zero.
 */
export function ScoreRing({ value, className, delaySeconds = 0.25 }: ScoreRingProps) {
  const isAnswered = value !== null;
  const filled = isAnswered ? Math.max(0, Math.min(value, 100)) / 100 : 0;
  const isStrong = isAnswered && value >= STRONG_MATCH;

  return (
    <div className={cn("relative size-16 shrink-0", className)}>
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="size-full -rotate-90">
        <circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={RADIUS}
          fill="none"
          strokeWidth="6"
          className="stroke-border"
        />
        {isAnswered ? (
          <circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className={cn("ring-progress", isStrong ? "stroke-brand" : "stroke-muted-foreground")}
            style={
              {
                "--ring-length": CIRCUMFERENCE,
                "--ring-offset": CIRCUMFERENCE * (1 - filled),
                animationDelay: `${delaySeconds}s`,
              } as React.CSSProperties
            }
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {isAnswered ? (
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              isStrong ? "text-brand" : "text-muted-foreground",
            )}
          >
            {value}
          </span>
        ) : (
          <span className="text-2xs leading-tight font-medium text-muted-foreground">n/a</span>
        )}
      </div>
    </div>
  );
}
