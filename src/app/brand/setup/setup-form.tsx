"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormMessage, SubmitButton } from "@/components/auth/field";

import { submitWebsite, type SetupState } from "./actions";

const INITIAL: SetupState = { error: null, unavailable: null };

/**
 * One field (PRODUCT.md step 2).
 *
 * naano asks for the same thing and says it takes 20–40 seconds
 * (`recon/brand/04`), which is honest about a model call and worth repeating —
 * a button that looks stuck for half a minute is the same failure as a slow
 * page nobody explained.
 */
export function SetupForm({ demoDomain }: { demoDomain: string }) {
  const [state, formAction, pending] = useActionState(submitWebsite, INITIAL);

  if (state.unavailable) {
    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-lg border border-border p-5">
          <p className="text-sm font-medium">Your workspace is ready. The site was not read.</p>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">{state.unavailable}</p>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            Nothing was invented to fill the gap: there is no generated profile and
            there are no ICPs. Write them yourself on the next screen — it is the one
            step that cannot be skipped, because the match score is worthless without
            it.
          </p>
        </div>
        <Link
          href="/brand/icps"
          className="inline-block rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
        >
          Set up your ICPs →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <Field
        name="website"
        label="Your website"
        placeholder="acme.com"
        autoComplete="url"
        required
        hint={`We read the page and turn it into a value proposition and three ICPs, which usually takes 20–40 seconds. ${demoDomain} is a fixture, if you are looking at the demo.`}
      />

      <FormMessage error={state.error} />
      <SubmitButton pending={pending} pendingLabel="Reading your site…">
        Analyse my website
      </SubmitButton>

      <p className="text-xs text-pretty text-muted-foreground">
        Generated ICPs are a starting point you confirm on the next screen. Nothing
        is scored until you do.
      </p>
    </form>
  );
}
