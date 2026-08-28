"use client";

import { useActionState } from "react";

import { ChipGroup, type ChipOption } from "@/components/brand/chip-group";
import { FormMessage } from "@/components/auth/field";
import type { IcpTargets } from "@/lib/brand/intelligence";

import { submitIcp, type IcpFormState } from "./actions";

const INITIAL: IcpFormState = { error: null, savedAt: null };

const INPUT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type DimensionOptions = Readonly<Record<keyof IcpTargets, ReadonlyArray<ChipOption>>>;

/**
 * One ICP, editable (PRODUCT.md step 3).
 *
 * The paragraph and the chips do different jobs and the card says so: the
 * description is what a human reads and what brief generation is given, and the
 * chips are the only part the score reads. naano ships the paragraph alone,
 * which is why its ICP cannot say no to anybody.
 */
export function IcpCard({
  id,
  rank,
  label,
  description,
  isActive,
  targets,
  options,
  generated,
}: {
  id: string | null;
  rank: number;
  label: string;
  description: string;
  isActive: boolean;
  targets: IcpTargets;
  options: DimensionOptions;
  /** True while the row is still exactly as the website analysis wrote it. */
  generated: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitIcp, INITIAL);

  // Remounts the fields when the server hands back a different ICP after a
  // save, so the chips show what was stored rather than what was typed.
  const key = `${id ?? "new"}:${state.savedAt ?? "initial"}`;

  return (
    <form action={formAction} className="rounded-xl border border-border p-5">
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="rank" value={rank} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          ICP {rank}
          {id === null ? " · not created yet" : generated ? " · as generated" : ""}
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={isActive}
            key={`${key}:active`}
            className="size-3.5"
          />
          Score creators against this one
        </label>
      </div>

      <div className="mt-3 space-y-3" key={key}>
        <input
          name="label"
          defaultValue={label}
          placeholder="Sales engineering leaders, EU manufacturing"
          maxLength={120}
          required
          aria-label={`Name for ICP ${rank}`}
          className={`${INPUT_CLASS} font-medium`}
        />

        <div className="space-y-1.5">
          <textarea
            name="description"
            defaultValue={description}
            rows={3}
            maxLength={1000}
            placeholder="Who they are and why they buy."
            aria-label={`Description for ICP ${rank}`}
            className={INPUT_CLASS}
          />
          <p className="text-xs text-pretty text-muted-foreground">
            Read by you, and used to write briefs. Nothing is scored against it — the
            chips below are the part the match score reads.
          </p>
        </div>

        <div className="grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
          <ChipGroup
            dimension="job_function"
            legend="Job function"
            options={options.job_function}
            initial={targets.job_function}
            emptyMeans="Not targeted. This dimension is dropped and the other weights renormalise."
          />
          <ChipGroup
            dimension="seniority"
            legend="Seniority"
            options={options.seniority}
            initial={targets.seniority}
            emptyMeans="Not targeted. This dimension is dropped and the other weights renormalise."
          />
          <ChipGroup
            dimension="industry"
            legend="Industry"
            options={options.industry}
            initial={targets.industry}
            emptyMeans="Not targeted. This dimension is dropped and the other weights renormalise."
          />
          <ChipGroup
            dimension="geo"
            legend="Region"
            options={options.geo}
            initial={targets.geo}
            emptyMeans="Not targeted. This dimension is dropped and the other weights renormalise."
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : id === null ? `Create ICP ${rank}` : "Save"}
        </button>
        {state.savedAt !== null ? (
          <span role="status" className="text-sm text-muted-foreground">
            Saved.
          </span>
        ) : null}
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}
