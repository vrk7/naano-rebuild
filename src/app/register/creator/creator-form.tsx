"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Field, FormMessage, SubmitButton } from "@/components/ui/field";
import { LOGIN_PATH } from "@/lib/auth/roles";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/credentials";
import { MAX_TOPICS } from "@/lib/auth/creator-signup";
import { cn } from "@/lib/utils";

import { registerCreator, type AuthState } from "../actions";

const INITIAL: AuthState = { error: null };

export type Industry = { id: string; label: string };

/**
 * The creator branch, in one screen.
 *
 * naano spends five on this: signup, LinkedIn URL, country and industries,
 * price, an optional bundle, and an optional professional-information step
 * about registered activity and invoicing (`recon/creator/01`–`creator/06`).
 * Bundles and payouts are cut in SCOPE.md, country is prefilled from a scrape
 * we do not perform, and nothing reads the rest. What remains is a profile URL,
 * up to three industries, and a price — the three things a marketplace listing
 * is made of.
 */
export function CreatorForm({
  industries,
  returnTo,
}: {
  industries: ReadonlyArray<Industry>;
  returnTo: string | null;
}) {
  const [state, formAction, pending] = useActionState(registerCreator, INITIAL);
  const [picked, setPicked] = useState<ReadonlyArray<string>>([]);

  const atLimit = picked.length >= MAX_TOPICS;

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <>
      <form action={formAction} className="mt-8 space-y-5">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />

        <Field
          name="linkedinUrl"
          label="Public LinkedIn profile URL"
          type="url"
          inputMode="url"
          placeholder="linkedin.com/in/your-name"
          required
          hint="We do not read your profile. Unlike naano there is no scrape here, so your display name comes from this URL and nothing else is imported."
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            What you post about{" "}
            <span className="font-normal text-muted-foreground">
              — pick up to {MAX_TOPICS}
            </span>
          </legend>

          <div className="flex flex-wrap gap-2">
            {industries.map((industry) => {
              const isPicked = picked.includes(industry.id);
              return (
                <label
                  key={industry.id}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
                    isPicked
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                    // Beyond the limit the remaining chips stop responding, which
                    // is a clearer statement of the rule than letting someone pick
                    // a fourth and rejecting the form for it.
                    !isPicked && atLimit && "cursor-not-allowed opacity-40",
                  )}
                >
                  <input
                    type="checkbox"
                    name="topics"
                    value={industry.id}
                    checked={isPicked}
                    disabled={!isPicked && atLimit}
                    onChange={() => toggle(industry.id)}
                    className="sr-only"
                  />
                  {industry.label}
                </label>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            {picked.length} of {MAX_TOPICS} chosen. Brands filter the marketplace on
            these, so pick what you would want to be found for.
          </p>
        </fieldset>

        <Field
          name="price"
          label="Price per post (USD)"
          type="text"
          inputMode="decimal"
          placeholder="1200"
          required
          hint="What a brand pays for one sponsored post. You can be booked at this price and no other — there are no bundles and no negotiation."
        />

        <FormMessage error={state.error} notice={state.notice} />
        <SubmitButton pending={pending} pendingLabel="Creating your listing…">
          Create my listing
        </SubmitButton>

        {/* Said before signing up rather than discovered afterwards. A creator
            with no audience_snapshot cannot be scored, and the marketplace drops
            what it cannot score rather than showing a zero. */}
        <p className="text-xs text-pretty text-muted-foreground">
          Your listing will not appear in the marketplace until there is an audience
          snapshot for it. We do not scrape LinkedIn, so we do not have one yet, and
          a creator we cannot score is left out rather than shown at zero.
        </p>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={LOGIN_PATH} className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
