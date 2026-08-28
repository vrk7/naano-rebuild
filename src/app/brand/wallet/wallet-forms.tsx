"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, Input, Label, SubmitButton } from "@/components/ui/field";

import { releaseDue, topUp, type WalletState } from "./actions";

const INITIAL: WalletState = { error: null, notice: null };

/**
 * SCOPE.md: a button that writes a `topup` row. There is no payment flow behind
 * it and the copy says so — pretending otherwise would be the one lie this
 * product is built to avoid.
 */
export function TopUpForm() {
  const [state, formAction, pending] = useActionState(topUp, INITIAL);

  return (
    <form action={formAction} className="space-y-2.5">
      <div className="space-y-1.5">
        <Label htmlFor="amount">Add to the balance</Label>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
          >
            $
          </span>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="2500"
            required
            className="num pl-5 tabular-nums"
          />
        </div>
      </div>

      <SubmitButton pending={pending} pendingLabel="Adding…" className="w-full">
        Add funds
      </SubmitButton>

      <FormMessage error={state.error} notice={state.notice} />

      <p className="text-xs text-pretty text-muted-foreground">
        No card, no payment. This writes a ledger row so a booking has something to
        commit against.
      </p>
    </form>
  );
}

/**
 * Closing what is due (PRODUCT.md step 15).
 *
 * The button only ever asks whether a close is due — the database refuses
 * anything still inside its measurement window — so a brand cannot release its
 * own money early by pressing it.
 */
export function ReleaseDueForm({ collaborationIds }: { collaborationIds: ReadonlyArray<string> }) {
  const [state, formAction, pending] = useActionState(
    async (_previous: WalletState) => releaseDue(collaborationIds),
    INITIAL,
  );

  if (collaborationIds.length === 0) return null;

  return (
    <form action={formAction} className="space-y-2">
      <Button type="submit" size="lg" variant="outline" disabled={pending}>
        {pending
          ? "Closing…"
          : `Close ${collaborationIds.length} due ${
              collaborationIds.length === 1 ? "collaboration" : "collaborations"
            }`}
      </Button>
      <FormMessage error={state.error} notice={state.notice} />
    </form>
  );
}
