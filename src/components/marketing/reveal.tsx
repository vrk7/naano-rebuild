"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * How much of the element has to be on screen before it animates in. Low
 * enough that tall sections trigger as their top edge arrives; high enough
 * that a 1px sliver does not count. Chosen by eye, not measured.
 */
const VISIBLE_RATIO = 0.12;

type RevealProps = React.ComponentProps<"div"> & {
  /** Stagger offset for siblings revealed together. */
  delayMs?: number;
};

/**
 * Fades and lifts its children the first time they scroll into view, then
 * disconnects. Reduced-motion users get the final state immediately, via the
 * `.reveal` rules in globals.css.
 */
export function Reveal({ className, delayMs = 0, style, ...props }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isShown, setIsShown] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hasArrived = entries.some((entry) => entry.isIntersecting);
        if (!hasArrived) return;
        setIsShown(true);
        observer.disconnect();
      },
      { threshold: VISIBLE_RATIO },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown={isShown}
      className={cn("reveal", className)}
      style={{ transitionDelay: `${delayMs}ms`, ...style }}
      {...props}
    />
  );
}
