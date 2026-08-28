"use client";

import { useActionState, useState } from "react";

import { signIn, signUp, type AuthState } from "./actions";
import { ROLES } from "@/lib/auth/roles";

const INITIAL: AuthState = { error: null };

const ROLE_COPY: Record<(typeof ROLES)[number], { label: string; hint: string }> = {
  brand: { label: "Brand", hint: "Run campaigns and see who your posts reached." },
  creator: { label: "Creator", hint: "Write and publish posts you have been booked for." },
};

export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "signin"
            ? "Welcome back."
            : "Pick the side you are on. It decides what you see."}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {mode === "signup" ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">I am a</legend>
            {ROLES.map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  defaultChecked={role === "brand"}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">{ROLE_COPY[role].label}</span>
                  <span className="block text-muted-foreground">
                    {ROLE_COPY[role].hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {pending
            ? "Working…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        {mode === "signin" ? "No account yet? " : "Already have one? "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
