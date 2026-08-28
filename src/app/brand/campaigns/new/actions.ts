"use server";

import { redirect } from "next/navigation";

import { parseCampaignForm } from "@/lib/campaign/parse";
import { createCampaign } from "@/lib/campaign/queries";

export type CampaignFormState = { error: string | null };

/**
 * Creates a campaign and its brief in one submit.
 *
 * The whole screen parses before anything is written, so there is no state
 * where a campaign exists and its brief turned out to be invalid. Failures from
 * the database are allowed to throw — they are bugs or outages, not something a
 * brand can fix by editing a field — while everything a person can correct
 * comes back as a message on the form.
 */
export async function submitCampaign(
  _previous: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const parsed = parseCampaignForm(formData);
  if (parsed.kind === "invalid") return { error: parsed.error };

  const campaignId = await createCampaign(parsed.value);

  // redirect throws, so it must sit outside any try/catch.
  redirect(`/brand/campaigns/${campaignId}`);
}
