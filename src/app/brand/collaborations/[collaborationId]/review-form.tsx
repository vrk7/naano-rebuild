"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/field";

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
      <Textarea
        name="note"
        rows={3}
        maxLength={2000}
        aria-label="What needs changing"
        placeholder="What needs changing? Required if you send it back — it is the only thing the creator gets."
      />

      {/* Approve is the primary; sending back is an outline button rather than
          a second filled one. Two equally-weighted buttons make the reader stop
          and work out which is which every time. */}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approve" size="lg" disabled={pending}>
          {pending ? "Working…" : "Approve"}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="request_changes"
          size="lg"
          variant="outline"
          disabled={pending}
        >
          Send back with the note
        </Button>
      </div>

      <FormMessage error={state.error} />
    </form>
  );
}
