import { cn } from "@/lib/utils";

/**
 * Small status labels.
 *
 * `neutral` is the default and should stay the common case. `accent` is the
 * only variant that spends the brand colour, so it is reserved for the selected
 * or active thing — not for "good news", which is what `positive` is for.
 */
const VARIANT = {
  neutral: "border-border bg-muted text-muted-foreground",
  outline: "border-border text-muted-foreground",
  accent: "border-brand/25 bg-brand-soft text-brand",
  positive: "border-positive/25 bg-positive-soft text-positive",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-destructive/25 bg-destructive-soft text-destructive",
} as const;

export type BadgeVariant = keyof typeof VARIANT;

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
