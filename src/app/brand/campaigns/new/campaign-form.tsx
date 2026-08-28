"use client";

import { useActionState, useState } from "react";

import { Field, FormMessage, SubmitButton } from "@/components/auth/field";
import { BRIEF_MODES, type BriefMode } from "@/lib/campaign/parse";
import { LINKEDIN_POST_MAX_CHARS } from "@/lib/campaign/requirements";
import { cn } from "@/lib/utils";

import { submitCampaign, type CampaignFormState } from "./actions";

const INITIAL: CampaignFormState = { error: null };

export type Region = { code: string; label: string };

const MODE_COPY: Readonly<Record<BriefMode, { label: string; hint: string }>> = {
  specific: {
    label: "Specific",
    hint: "You set the rules. Required mentions, banned claims, a length band, disclosure — each one becomes a check the draft is measured against, citing the span it judged.",
  },
  creative_freedom: {
    label: "Creative freedom",
    hint: "One line of direction and nothing else. No requirements are stored, so every check passes and the creator writes it their way.",
  },
};

/**
 * Campaign and brief, in one submit (PRODUCT.md step 4).
 *
 * The campaign exists before the marketplace, which is the fix for naano's dead
 * end at `brand/14` — but the brief is allowed to be one line, so it is not a
 * fix by ceremony. Creative freedom is a real mode here and not a disabled
 * radio: picking it hides the requirements form and stores `{}`.
 */
export function CampaignForm({ regions }: { regions: ReadonlyArray<Region> }) {
  const [state, formAction, pending] = useActionState(submitCampaign, INITIAL);
  const [mode, setMode] = useState<BriefMode>("specific");
  const [geos, setGeos] = useState<ReadonlyArray<string>>([]);

  function toggleGeo(code: string) {
    setGeos((current) =>
      current.includes(code) ? current.filter((value) => value !== code) : [...current, code],
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-medium">The campaign</h2>

        <Field
          name="name"
          label="Name"
          placeholder="EU manufacturing — RFQ turnaround"
          required
          maxLength={120}
        />

        <div className="space-y-1.5">
          <label htmlFor="objective" className="block text-sm font-medium">
            Objective <span className="font-normal text-muted-foreground">— optional</span>
          </label>
          <textarea
            id="objective"
            name="objective"
            rows={2}
            maxLength={500}
            placeholder="Reach sales engineering leaders at industrial manufacturers."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            For your own team. It is not shown to creators and nothing scores against it.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            Target regions{" "}
            <span className="font-normal text-muted-foreground">— optional</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {regions.map((region) => {
              const isPicked = geos.includes(region.code);
              return (
                <label
                  key={region.code}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
                    isPicked
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <input
                    type="checkbox"
                    name="geos"
                    value={region.code}
                    checked={isPicked}
                    onChange={() => toggleGeo(region.code)}
                    className="sr-only"
                  />
                  {region.label}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-pretty text-muted-foreground">
            {geos.length === 0
              ? "None selected, which means no geographic restriction. Creators are still scored against your ICPs' own regions."
              : `${geos.length} selected. This records where the campaign is aimed; the match score reads your ICPs, not this.`}
          </p>
        </fieldset>
      </section>

      <section className="space-y-4 border-t border-border pt-8">
        <h2 className="text-sm font-medium">The brief</h2>

        <fieldset className="space-y-2">
          <legend className="sr-only">Brief mode</legend>
          {BRIEF_MODES.map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm transition-colors",
                mode === option ? "border-brand bg-brand-soft" : "border-border hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="mode"
                value={option}
                checked={mode === option}
                onChange={() => setMode(option)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{MODE_COPY[option].label}</span>
                <span className="mt-0.5 block text-pretty text-muted-foreground">
                  {MODE_COPY[option].hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="body" className="block text-sm font-medium">
            {mode === "creative_freedom" ? "Your one line" : "What the post should do"}
          </label>
          <textarea
            id="body"
            name="body"
            rows={mode === "creative_freedom" ? 2 : 5}
            maxLength={4000}
            required
            placeholder={
              mode === "creative_freedom"
                ? "Your take on where quoting breaks down in industrial supply chains."
                : "Talk about what a slow quote actually costs an industrial manufacturer — the deal that goes quiet, not the admin hours."
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            The creator reads this. One line is a valid brief.
          </p>
        </div>

        {/* Unmounted rather than hidden in creative freedom. The action ignores
            these fields in that mode anyway, but leaving them in the DOM invites
            the reading that they are stored and merely not shown. */}
        {mode === "specific" ? <RequirementsFields /> : null}
      </section>

      <div className="space-y-3 border-t border-border pt-6">
        <FormMessage error={state.error} />
        <SubmitButton pending={pending} pendingLabel="Creating…">
          Create campaign
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * The requirements form.
 *
 * Every field is optional, including all of them at once. A specific brief that
 * requires nothing is a real answer — the campaign page then says the checks
 * pass vacuously rather than implying rules exist.
 */
function RequirementsFields() {
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <p className="text-xs text-pretty text-muted-foreground">
        Each of these becomes a deterministic check when the creator submits a draft.
        All optional — leave them empty and the brief is prose only.
      </p>

      <PhraseField
        name="mustMention"
        label="Must mention"
        placeholder={"Atira\nRFQ turnaround"}
        hint="One per line. The draft has to contain each of these."
      />

      <PhraseField
        name="bannedClaims"
        label="Banned claims"
        placeholder={"guaranteed\nfastest in the world"}
        hint="One per line. A draft containing any of these fails, and the check cites where."
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          name="lengthMin"
          label="Minimum length"
          type="text"
          inputMode="numeric"
          placeholder="400"
        />
        <Field
          name="lengthMax"
          label="Maximum length"
          type="text"
          inputMode="numeric"
          placeholder="1800"
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Characters. Either bound on its own is fine. LinkedIn refuses a post over{" "}
        {LINKEDIN_POST_MAX_CHARS.toLocaleString()} characters, so that is the ceiling.
      </p>

      <Checkbox
        name="mustIncludeLink"
        label="Must include the tracked link"
        hint="Without it the post cannot be attributed back to this campaign."
      />
      <Checkbox
        name="requiresDisclosure"
        label="Must carry a paid-partnership disclosure"
        hint="Sponsored content rules require it in most jurisdictions."
      />
    </div>
  );
}

function PhraseField({
  name,
  label,
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  placeholder: string;
  hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Checkbox({ name, label, hint }: { name: string; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} className="mt-0.5" />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
