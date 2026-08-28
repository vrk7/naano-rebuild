"use client";

import * as React from "react";

/**
 * Long enough to read as a count rather than a flicker, short enough that the
 * final number is settled before a scrolling reader has left the section.
 * Guessed — nothing measured behind it.
 */
const COUNT_DURATION_MS = 1200;

const VISIBLE_RATIO = 0.4;

const formatter = new Intl.NumberFormat("en-US");

/** Decelerating curve, so the number lands rather than stopping dead. */
function easeOut(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

type CountUpProps = {
  value: number;
  prefix?: string;
  suffix?: string;
};

/** Counts from zero to `value` the first time it scrolls into view. */
export function CountUp({ value, prefix = "", suffix = "" }: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [shown, setShown] = React.useState(0);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    const run = (startedAt: number) => {
      const step = (now: number) => {
        const progress = Math.min((now - startedAt) / COUNT_DURATION_MS, 1);
        setShown(Math.round(value * easeOut(progress)));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        run(performance.now());
      },
      { threshold: VISIBLE_RATIO },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {formatter.format(shown)}
      {suffix}
    </span>
  );
}
