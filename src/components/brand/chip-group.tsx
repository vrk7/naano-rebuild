"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type ChipOption = { readonly value: string; readonly label: string };

/**
 * One dimension of an ICP, as chips (PRODUCT.md step 3).
 *
 * "The targets are editable chips, not prose." Each chip is a checkbox named
 * after its dimension, so the form submits `geo=DE&geo=NL` and the parser reads
 * it with `getAll`.
 *
 * The line underneath states the count rather than judging it. A dimension with
 * every value selected filters nothing — which is the score-that-cannot-say-no
 * this product exists to correct, arriving through the ICP instead of through
 * the ranking — and a brand can see that from "8 of 8" without being told a
 * number they did not choose is wrong.
 */
export function ChipGroup({
  dimension,
  legend,
  options,
  initial,
  emptyMeans,
}: {
  dimension: string;
  legend: string;
  options: ReadonlyArray<ChipOption>;
  initial: ReadonlyArray<string>;
  emptyMeans: string;
}) {
  const [selected, setSelected] = useState<ReadonlyArray<string>>(initial);

  function toggle(value: string) {
    setSelected((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );
  }

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>

      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const isPicked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                // Square-ish, not pills: these are toggles in a dense grid, and
                // a matched radius across chips, badges and buttons is what
                // keeps four ICP fieldsets from reading as four widgets.
                "cursor-pointer rounded-md border px-2 py-0.5 text-xs transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/25",
                isPicked
                  ? "border-brand/40 bg-brand-soft font-medium text-brand"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <input
                type="checkbox"
                name={dimension}
                value={option.value}
                checked={isPicked}
                onChange={() => toggle(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>

      <p className="mt-1.5 text-xs text-pretty text-muted-foreground">
        {selected.length === 0
          ? emptyMeans
          : selected.length === options.length
            ? `All ${options.length} selected, which filters nothing — the same answer as selecting none, with more confidence attached.`
            : `${selected.length} of ${options.length} selected.`}
      </p>
    </fieldset>
  );
}
