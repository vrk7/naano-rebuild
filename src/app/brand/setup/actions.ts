"use server";

import { redirect } from "next/navigation";

import { acceptWebsite, generateBrandIntelligence } from "@/lib/brand/generate";
import { buildVocabulary } from "@/lib/brand/intelligence";
import { createBrandWorkspace, loadWorkspace } from "@/lib/brand/queries";
import { loadTopics } from "@/lib/taxonomy/queries";

export type SetupState = {
  readonly error: string | null;
  /**
   * Set when the workspace was created but the site could not be read. Not an
   * error — there is nothing to fix and nothing to retry — but the brand is
   * owed the reason before they fill three ICPs in by hand.
   */
  readonly unavailable: string | null;
};

/**
 * The website step (PRODUCT.md step 2).
 *
 * One field, then a workspace. Generation is allowed to fail: the workspace is
 * created either way, because the alternative is an account that can never
 * onboard when a site is down or no model key is configured. What it must never
 * do is invent a profile or an ICP to fill the gap — a confidently wrong ICP is
 * worse than an absent one, since the score would be computed from it.
 */
export async function submitWebsite(
  _previous: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const website = acceptWebsite(formData.get("website"));
  if (website.kind === "invalid") return { error: website.error, unavailable: null };

  // Creating a second workspace is refused by the function anyway; catching it
  // here sends them where they were going instead of showing them a refusal.
  if (await loadWorkspace()) redirect("/brand");

  const vocabulary = buildVocabulary(await loadTopics());
  const generated = await generateBrandIntelligence(website.value, vocabulary);
  const intelligence = generated.kind === "ok" ? generated.intelligence : null;

  const created = await createBrandWorkspace({
    // The company name when we have one, the domain when we do not. A domain is
    // a fact about what was pasted; anything else here would be a guess.
    name: intelligence?.profile.companyName ?? new URL(website.value).hostname,
    website: website.value,
    intelligence,
  });

  if (created.kind === "refused") return { error: created.reason, unavailable: null };

  // redirect throws, so it must sit outside any try/catch.
  if (generated.kind === "ok") redirect("/brand/icps");

  return { error: null, unavailable: generated.reason };
}
