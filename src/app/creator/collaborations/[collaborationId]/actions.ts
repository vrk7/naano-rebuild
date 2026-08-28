"use server";

import { revalidatePath } from "next/cache";

import { applyTransition } from "@/lib/collaboration/transitions";
import { parseDraftForm, parsePublishForm } from "@/lib/draft/parse";
import { publishPost, submitDraft } from "@/lib/draft/queries";

export type RespondState = { error: string | null };

/**
 * Accept or decline (PRODUCT.md step 8).
 *
 * The two answers a creator has. SCOPE.md cuts counter-offers, so there is no
 * third — one price, sent once. Which one this is comes from the button that
 * submitted the form, and the machine decides whether it is still available:
 * an invitation whose 72 hours have run cannot be accepted, and can still be
 * declined.
 */
export async function respond(
  collaborationId: string,
  _previous: RespondState,
  formData: FormData,
): Promise<RespondState> {
  const decision = formData.get("decision");

  if (decision !== "accept" && decision !== "decline") {
    return { error: "Choose accept or decline." };
  }

  const result = await applyTransition(
    collaborationId,
    decision === "accept" ? { kind: "accept" } : { kind: "decline" },
  );

  if (result.kind === "refused") return { error: result.reason };

  revalidatePath("/creator");
  revalidatePath(`/creator/collaborations/${collaborationId}`);
  return { error: null };
}

export type DraftState = { readonly error: string | null; readonly version: number | null };

/**
 * Submitting a draft (PRODUCT.md step 9).
 *
 * The checks run inside `submitDraft`, in the same transaction as the draft and
 * the state change, so the creator sees the verdict on the very next render and
 * the brand can never open a review whose checks have not landed.
 *
 * A draft that fails its checks still submits. PRODUCT.md has the creator see
 * the failures and revise; refusing the submit would leave a brand who asked to
 * approve the draft unable to see that it breaks their own brief.
 */
export async function submitDraftVersion(
  collaborationId: string,
  _previous: DraftState,
  formData: FormData,
): Promise<DraftState> {
  const body = parseDraftForm(formData);
  if (body.kind === "invalid") return { error: body.error, version: null };

  const result = await submitDraft(collaborationId, body.value);
  if (result.kind === "refused") return { error: result.reason, version: null };

  revalidatePath("/creator");
  revalidatePath(`/creator/collaborations/${collaborationId}`);
  return { error: null, version: result.value.version };
}

export type PublishState = { readonly error: string | null };

/**
 * Publishing (PRODUCT.md step 11).
 *
 * The creator posts to LinkedIn themselves and pastes the link back — there is
 * no API and SCOPE.md says so plainly. The URL is parsed before it is stored
 * because `creator_post.external_url` is unique, and a constraint over
 * unnormalised strings stops meaning anything.
 */
export async function publishCollaboration(
  collaborationId: string,
  _previous: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const url = parsePublishForm(formData);
  if (url.kind === "invalid") return { error: url.error };

  const result = await publishPost(collaborationId, url.value);
  if (result.kind === "refused") return { error: result.reason };

  revalidatePath("/creator");
  revalidatePath(`/creator/collaborations/${collaborationId}`);
  return { error: null };
}
