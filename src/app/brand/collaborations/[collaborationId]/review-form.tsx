"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/field";

import { reviewDraft, type ReviewState } from "./actions";

const INITIAL: ReviewState = { error: null };

/**
 * Approve, or send it back (PRODUCT.md step 10).
 *
 * One form, two buttons, so the decision and the note cannot disagree about
 * what they belong to. The note is only required for one of them, and the
 * machine says so rather than this form — there is one place that knows which
 * transitions need what.
 */
export function ReviewForm({ collaborationId }: { collaborationId: string }) {
  const [state, formAction, pending] = useActionState(
    reviewDraft.bind(null, collaborationId),
    INITIAL,
  );

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <textarea
        name="note"
        rows={3}
        maxLength={2000}
        aria-label="What needs changing"
        placeholder="What needs changing? Required if you send it back — it is the only thing the creator gets."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {pending ? "Working…" : "Approve"}
        </button>
        <button
          type="submit"
          name="decision"
          value="request_changes"
          disabled={pending}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          Send back with the note
        </button>
      </div>

      <FormMessage error={state.error} />
    </form>
  );
}
