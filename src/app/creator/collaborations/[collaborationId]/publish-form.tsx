"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/field";

import { publishCollaboration, type PublishState } from "./actions";

const INITIAL: PublishState = { error: null };

/**
 * Recording the published post (PRODUCT.md step 11).
 *
 * There is no publish button that posts for you: SCOPE.md cuts the LinkedIn
 * API, and this link is the only evidence the post exists. Everything the brand
 * sees afterwards — the engagement, the people, the companies — hangs off it.
 */
export function PublishForm({ collaborationId }: { collaborationId: string }) {
  const [state, formAction, pending] = useActionState(
    publishCollaboration.bind(null, collaborationId),
    INITIAL,
  );

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input
        name="external_url"
        type="url"
        required
        aria-label="Link to your published post"
        placeholder="https://www.linkedin.com/posts/…"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
      >
        {pending ? "Recording…" : "I have published it"}
      </button>
      <FormMessage error={state.error} />
      <p className="text-xs text-pretty text-muted-foreground">
        Post it on LinkedIn yourself, then paste the link here. Use the post&apos;s own
        link — the one from “Copy link to post”.
      </p>
    </form>
  );
}
