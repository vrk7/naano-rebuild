"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/field";
import { LINKEDIN_POST_MAX_CHARS } from "@/lib/campaign/requirements";

import { submitDraftVersion, type DraftState } from "./actions";

const INITIAL: DraftState = { error: null, version: null };

/**
 * Writing the post (PRODUCT.md step 9).
 *
 * Prefilled with the last version when there is one, because a creator sent
 * back for changes is editing rather than starting again.
 *
 * The counter is the platform's limit, not ours: LinkedIn refuses a post over
 * 3,000 characters, so a draft above it could not be published even if the
 * brief allowed it. Any length band the brief sets is checked on submit and
 * shown with the rest of the results.
 */
export function DraftForm({
  collaborationId,
  previousBody,
  isRevision,
}: {
  collaborationId: string;
  previousBody: string;
  isRevision: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    submitDraftVersion.bind(null, collaborationId),
    INITIAL,
  );
  const [body, setBody] = useState(previousBody);

  const over = body.length > LINKEDIN_POST_MAX_CHARS;

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <Textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={12}
        required
        aria-label="Your draft"
        placeholder="Write the post."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || over}>
          {pending ? "Submitting…" : isRevision ? "Submit a new version" : "Submit the draft"}
        </Button>
        {/* The counter is tabular so it does not jitter sideways as the digits
            change under the cursor — it updates on every keystroke. */}
        <span
          className={
            over
              ? "num text-sm font-medium tabular-nums text-destructive"
              : "num text-sm tabular-nums text-muted-foreground"
          }
        >
          {body.length.toLocaleString()} / {LINKEDIN_POST_MAX_CHARS.toLocaleString()}
          {over ? " — LinkedIn will not accept this" : ""}
        </span>
      </div>

      <FormMessage error={state.error} />
      <p className="text-xs text-pretty text-muted-foreground">
        The brief&apos;s rules are checked when you submit, and you see the results
        before the brand does.
      </p>
    </form>
  );
}
