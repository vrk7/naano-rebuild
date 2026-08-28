"use client";

import { useActionState } from "react";

import { ChipGroup, type ChipOption } from "@/components/brand/chip-group";
import { Badge } from "@/components/ui/badge";
import { FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/field";
import type { IcpTargets } from "@/lib/brand/intelligence";

import { submitIcp, type IcpFormState } from "./actions";

const INITIAL: IcpFormState = { error: null, savedAt: null };

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
    <form action={formAction} className="rounded-lg border border-border">
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="rank" value={rank} />

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-t-lg border-b border-border bg-subtle px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="eyebrow">ICP {rank}</span>
          {id === null ? (
            <Badge variant="outline">not created yet</Badge>
          ) : generated ? (
            <Badge variant="outline">as generated</Badge>
          ) : null}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={isActive}
            key={`${key}:active`}
            className="size-3.5 accent-[var(--brand)]"
          />
          Score creators against this one
        </label>
      </div>

      <div className="space-y-3 px-4 py-3.5" key={key}>
        <Input
          name="label"
          defaultValue={label}
          placeholder="Sales engineering leaders, EU manufacturing"
          maxLength={120}
          required
          aria-label={`Name for ICP ${rank}`}
          className="text-md font-medium"
        />

        <div className="space-y-1.5">
          <Textarea
            name="description"
            defaultValue={description}
            rows={3}
            maxLength={1000}
            placeholder="Who they are and why they buy."
            aria-label={`Description for ICP ${rank}`}
          />
          <p className="text-xs text-pretty text-muted-foreground">
            Read by you, and used to write briefs. Nothing is scored against it — the
            chips below are the part the match score reads.
          </p>
        </div>

        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
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

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {id === null ? `Create ICP ${rank}` : "Save"}
        </SubmitButton>
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
