"use server";

import { revalidatePath } from "next/cache";

import { applyTransition } from "@/lib/collaboration/transitions";

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
