"use server";

import { revalidatePath } from "next/cache";

import { applyTransition } from "@/lib/collaboration/transitions";

export type ReviewState = { readonly error: string | null };

/**
 * The brand's two answers to a draft (PRODUCT.md step 10).
 *
 * Approve, or send it back with a note. The note is not optional and the
 * machine is what enforces that: SCOPE.md cuts messaging, so it is the only
 * channel a brand has for saying what is wrong, and a creator told to try again
 * with nothing else has been told nothing.
 */
export async function reviewDraft(
  collaborationId: string,
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const decision = formData.get("decision");
  const note = formData.get("note");

  if (decision !== "approve" && decision !== "request_changes") {
    return { error: "Choose approve or request changes." };
  }

  const result = await applyTransition(
    collaborationId,
    decision === "approve"
      ? { kind: "approve" }
      : { kind: "request_changes", note: typeof note === "string" ? note : "" },
  );

  if (result.kind === "refused") return { error: result.reason };

  revalidatePath(`/brand/collaborations/${collaborationId}`);
  return { error: null };
}
