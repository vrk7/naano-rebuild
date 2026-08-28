"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";

import { respond, type RespondState } from "./actions";

const INITIAL: RespondState = { error: null };

/**
 * The two answers, in one form.
 *
 * Which button was pressed arrives as `decision`, so accepting and declining
 * cannot disagree about what they were answering. Both are disabled while the
 * request is in flight, because the second click of a double-click would be
 * refused by the state guard and shown to the creator as an error they did not
 * cause.
 */
export function RespondForm({
  collaborationId,
  canAccept,
}: {
  collaborationId: string;
  /** False once the 72 hours have run. Declining stays open; the machine agrees. */
  canAccept: boolean;
}) {
  const [state, formAction, pending] = useActionState(respond.bind(null, collaborationId), INITIAL);

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {canAccept ? (
          <Button type="submit" name="decision" value="accept" size="lg" disabled={pending}>
            {pending ? "Working…" : "Accept and start drafting"}
          </Button>
        ) : null}
        <Button
          type="submit"
          name="decision"
          value="decline"
          size="lg"
          variant="outline"
          disabled={pending}
        >
          Decline
        </Button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}
