"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormMessage, SubmitButton } from "@/components/auth/field";
import { LOGIN_PATH } from "@/lib/auth/roles";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/credentials";

import { registerBrand, type AuthState } from "../actions";

const INITIAL: AuthState = { error: null };

/**
 * The brand branch: an account, and nothing else.
 *
 * Unchanged from the path that existed before the role picker came back. The
 * website, the generated brand profile and the ICPs come after signing in
 * (PRODUCT.md steps 2–3), because the ICP editor is the one onboarding step
 * that cannot be skipped and it deserves a screen rather than a field here.
 */
export function BrandForm({ returnTo }: { returnTo: string | null }) {
  const [state, formAction, pending] = useActionState(registerBrand, INITIAL);

  return (
    <>
      <form action={formAction} className="mt-8 space-y-4">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

        <Field name="email" label="Work email" type="email" autoComplete="email" required />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />

        <FormMessage error={state.error} />
        <SubmitButton pending={pending}>Create account</SubmitButton>
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
