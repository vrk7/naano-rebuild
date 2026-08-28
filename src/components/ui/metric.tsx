import { cn } from "@/lib/utils";

/**
 * A number and what it means.
 *
 * The label sits *above* the value and is the small, quiet half — the figure is
 * the thing being read, so it gets the weight and the size. Every value is
 * tabular, which is what lets a row of Metrics be scanned across as a row
 * rather than four unrelated boxes.
 *
 * `emphasis` is for the one number on a screen that the screen exists to show.
 * More than one per view and it stops meaning anything.
 */
export function Metric({
  label,
  value,
  note,
  emphasis = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "num mt-1 font-semibold tracking-[-0.01em] tabular-nums",
          emphasis ? "text-3xl" : "text-xl",
        )}
      >
        {value}
      </p>
      {note ? (
        <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

/**
 * A run of Metrics, divided rather than boxed.
 *
 * Hairlines between figures instead of a card around each one: four bordered
 * boxes in a row is four times the border for the same information, and the
 * brief asked for restraint over decoration.
 */
export function MetricRow({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"dl">) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4",
        "[&>*]:bg-background [&>*]:px-4 [&>*]:py-3",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A label/value pair on one line, for a stack of them inside a panel.
 * Baseline-aligned with the value hard right so the column of figures reads
 * down even when the labels are different lengths.
 */
export function MetricLine({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="num text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
