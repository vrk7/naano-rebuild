"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";

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
      <Input
        name="external_url"
        type="url"
        required
        aria-label="Link to your published post"
        placeholder="https://www.linkedin.com/posts/…"
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Recording…" : "I have published it"}
      </Button>
      <FormMessage error={state.error} />
      <p className="text-xs text-pretty text-muted-foreground">
        Post it on LinkedIn yourself, then paste the link here. Use the post&apos;s own
        link — the one from “Copy link to post”.
      </p>
    </form>
  );
}
