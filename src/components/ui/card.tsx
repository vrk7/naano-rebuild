import { cn } from "@/lib/utils";

/**
 * A bordered surface.
 *
 * Replaces the `rounded-xl border border-border p-5` string that had been typed
 * out by hand in fourteen places, at three different radii and two paddings.
 * One radius (`lg`, 8px) and one padding scale, so a panel next to a table next
 * to a form all sit on the same grid.
 */
export function Card({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card", className)}
      {...props}
    />
  );
}

/**
 * The header strip. Sits on `--subtle` with a hairline under it so a panel
 * reads as titled content rather than a box with bold text at the top.
 */
export function CardHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-t-lg border-b border-border bg-subtle px-4 py-2.5",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      className={cn("text-sm font-medium tracking-[-0.005em]", className)}
      {...props}
    />
  );
}

/** The right-hand side of a header: counts, timestamps, a mode chip. */
export function CardMeta({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return <div className={cn("px-4 py-3.5", className)} {...props} />;
}

/** A divided run inside a card, for actions or a summary line. */
export function CardFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-border px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}
