"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormMessage, SubmitButton } from "@/components/auth/field";
import { REGISTER_PATH, RETURN_TO_PARAM } from "@/lib/auth/roles";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/credentials";

import { signIn, type AuthState } from "./actions";

const INITIAL: AuthState = { error: null };

/**
 * Signing in, and only that.
 *
 * This form used to carry a second mode with a role radio inside it, which made
 * "which side of the product are you on" look like a preference on a form
 * rather than the first question. Creating an account now starts at the role
 * picker, and this screen has one job.
 */
export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);

  const registerHref = returnTo
    ? `${REGISTER_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`
    : REGISTER_PATH;

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back.</p>
      </div>

      <form action={formAction} className="space-y-4">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />

        <FormMessage error={state.error} />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>

      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Link
          href={registerHref}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
