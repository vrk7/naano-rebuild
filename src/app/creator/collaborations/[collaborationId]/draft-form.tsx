"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/auth/field";
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
      <textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={12}
        required
        aria-label="Your draft"
        placeholder="Write the post."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || over}
          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {pending ? "Submitting…" : isRevision ? "Submit a new version" : "Submit the draft"}
        </button>
        <span
          className={
            over ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"
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
