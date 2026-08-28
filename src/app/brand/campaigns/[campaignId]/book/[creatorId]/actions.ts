"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { parseBookingForm } from "@/lib/collaboration/booking";
import { bookCreator } from "@/lib/collaboration/queries";

export type BookingFormState = { error: string | null };

/**
 * Sends the offer (PRODUCT.md step 7).
 *
 * The whole form parses before anything is written, and what is written lands
 * in one transaction inside `book_creator` — the collaboration, its first
 * event, the commit against the wallet. Refusals a brand can act on (already
 * booked, not enough in the wallet) come back on the form; anything else is a
 * fault and throws.
 */
export async function submitBooking(
  campaignId: string,
  creatorId: string,
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const parsed = parseBookingForm(formData, new Date());
  if (parsed.kind === "invalid") return { error: parsed.error };

  const result = await bookCreator(campaignId, creatorId, parsed.value);
  if (result.kind === "refused") return { error: result.reason };

  revalidatePath(`/brand/campaigns/${campaignId}`);
  // redirect throws, so it must sit outside any try/catch.
  redirect(`/brand/campaigns/${campaignId}`);
}
