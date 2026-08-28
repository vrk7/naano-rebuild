import { cn } from "@/lib/utils";

/**
 * The bordered aside.
 *
 * This app argues with the reader a lot — why a score is withheld, why a filter
 * is off by default, what a vacuous check means — and every one of those had
 * grown its own `rounded-lg border border-dashed p-4 text-sm` string. Two tones,
 * with the distinction carried by the border:
 *
 * - `empty`  — dashed. Nothing is here yet. The dash says "a container waiting
 *              to be filled", which is exactly the state being reported.
 * - `note`   — solid, tinted. Something *is* here and this explains it.
 *
 * `warning` and `danger` are for a state the reader has to act on, and stay
 * rare; a page where every aside is coloured has no asides.
 */
const TONE = {
  empty: "border-dashed border-border text-muted-foreground",
  note: "border-border bg-muted/50 text-muted-foreground",
  warning: "border-warning/25 bg-warning-soft text-foreground",
  danger: "border-destructive/25 bg-destructive-soft text-foreground",
} as const;

export function Callout({
  tone = "note",
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { tone?: keyof typeof TONE }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm text-pretty [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Nothing here yet, plus the way out.
 *
 * Always takes an action or a sentence saying what would put something here. An
 * empty state that only reports emptiness leaves the reader where they started.
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border px-6 py-8 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      {children ? (
        <p className="mx-auto mt-1 max-w-prose text-sm text-pretty text-muted-foreground">
          {children}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
