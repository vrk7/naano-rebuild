"use server";

import { revalidatePath } from "next/cache";

import { buildVocabulary } from "@/lib/brand/intelligence";
import { parseIcpForm } from "@/lib/brand/icp-form";
import { saveIcp } from "@/lib/brand/queries";
import { loadTopics } from "@/lib/taxonomy/queries";

export type IcpFormState = {
  readonly error: string | null;
  /** Set on every save so the card can say something happened. */
  readonly savedAt: number | null;
};

/**
 * Saving one ICP (PRODUCT.md step 3).
 *
 * Per ICP rather than per screen: a brand fixing the geos on their second ICP
 * should not resubmit the other two, and `upsert_icp` already lands one ICP and
 * its whole target set in a single transaction.
 *
 * The vocabulary is loaded here rather than trusted from the form. The chips
 * were rendered from `topic` a moment ago, but what comes back is a POST body,
 * and a target outside the vocabulary is a row the score can never match.
 */
export async function submitIcp(
  _previous: IcpFormState,
  formData: FormData,
): Promise<IcpFormState> {
  const vocabulary = buildVocabulary(await loadTopics());

  const parsed = parseIcpForm(formData, vocabulary);
  if (parsed.kind === "invalid") return { error: parsed.error, savedAt: null };

  const saved = await saveIcp(parsed.value);
  if (saved.kind === "refused") return { error: saved.reason, savedAt: null };

  revalidatePath("/brand/icps");
  // The marketplace scores against these, so its pages are now stale.
  revalidatePath("/brand/creators");

  return { error: null, savedAt: Date.now() };
}
