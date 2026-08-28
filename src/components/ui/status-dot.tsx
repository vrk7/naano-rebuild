import { Check, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckStatus = "pass" | "warn" | "fail";

/**
 * Pass, warn or fail as a glyph.
 *
 * Three things this replaces, all of which were wrong:
 *
 * 1. Literal "✓" / "✕" / "!" text characters, which render in whatever the
 *    fallback font decides and sit off-centre in their circle.
 * 2. A *passing* check drawn in the brand colour. Passing is not the thing to
 *    look at, and spending the accent on it left a failure and a success
 *    competing for the same attention.
 * 3. Colour as the only signal, which the guidance calls out directly: the mark
 *    differs by shape too — tick, dash, cross — so the row still reads for
 *    anyone who cannot separate the green from the red.
 *
 * The status is also written out for screen readers by the caller, next to the
 * rule label, so this stays `aria-hidden`.
 */
const STYLE: Record<CheckStatus, string> = {
  pass: "border-positive/25 bg-positive-soft text-positive",
  warn: "border-warning/25 bg-warning-soft text-warning",
  fail: "border-destructive/25 bg-destructive-soft text-destructive",
};

const ICON: Record<CheckStatus, typeof Check> = {
  pass: Check,
  warn: Minus,
  fail: X,
};

export function StatusDot({
  status,
  className,
}: {
  status: CheckStatus;
  className?: string;
}) {
  const Icon = ICON[status];

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
        STYLE[status],
        className,
      )}
    >
      <Icon className="size-2.5" strokeWidth={3} />
    </span>
  );
}
