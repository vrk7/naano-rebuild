"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { MEASUREMENT_WINDOW_DAYS } from "@/lib/collaboration/machine";
import { parseTopupCents } from "@/lib/wallet/parse";

export type WalletState = { readonly error: string | null; readonly notice: string | null };

const REFUSALS: Readonly<Record<string, string>> = {
  invalid_amount: "A top-up has to be a positive amount.",
  no_workspace: "You are not a member of a workspace.",
  ambiguous_workspace:
    "This login belongs to more than one workspace, so there is no single wallet to top up.",
  no_wallet: "This workspace has no wallet.",
  not_found: "That collaboration does not exist.",
  not_published: "Only a published collaboration can close.",
  window_open: "The measurement window is still open.",
  no_published_at: "That collaboration has no publication date to measure from.",
};

function refusalFor(hint: string | undefined): string | undefined {
  return hint ? REFUSALS[hint] : undefined;
}

/**
 * SCOPE.md: "Wallet top-up | Button writes a `topup` ledger row". No payment
 * flow, and the row says so — a topup here is a number someone typed, not money
 * that arrived.
 */
export async function topUp(
  _previous: WalletState,
  formData: FormData,
): Promise<WalletState> {
  const amount = parseTopupCents(formData.get("amount"));
  if (amount.kind === "invalid") return { error: amount.error, notice: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc("topup_wallet", {
    p_amount_cents: amount.value,
  });

  if (error) {
    const refusal = refusalFor(error.hint ?? undefined);
    if (refusal) return { error: refusal, notice: null };
    throw new Error(`Could not top up the wallet: ${error.message}`);
  }

  revalidatePath("/brand/wallet");
  return { error: null, notice: "Added to the balance." };
}

/**
 * Closes every published collaboration whose measurement window has passed
 * (PRODUCT.md step 15), releasing each commitment back to the balance.
 *
 * The transition's actor is `system` and stays that way: the function refuses
 * anything still inside its window, so a brand pressing this can only ask
 * whether a close is due, never decide that it is. The alternative is a cron
 * runner, which is the right long-term home for it — this makes the state
 * reachable without one rather than pretending the sweep does not exist.
 */
export async function releaseDue(
  collaborationIds: ReadonlyArray<string>,
): Promise<WalletState> {
  if (collaborationIds.length === 0) {
    return { error: null, notice: "Nothing is due to close." };
  }

  const supabase = await createClient();

  for (const id of collaborationIds) {
    const { error } = await supabase.rpc("complete_collaboration", {
      p_collaboration_id: id,
      p_window_days: MEASUREMENT_WINDOW_DAYS,
    });

    if (error) {
      const refusal = refusalFor(error.hint ?? undefined);
      // A refusal mid-sweep is not fatal: the ones already closed stay closed,
      // and saying which one stopped it beats reporting a silent partial run.
      if (refusal) return { error: `${refusal} (${id.slice(0, 8)})`, notice: null };
      throw new Error(`Could not close that collaboration: ${error.message}`);
    }
  }

  revalidatePath("/brand/wallet");
  revalidatePath("/brand");
  return {
    error: null,
    notice: `Closed ${collaborationIds.length} ${
      collaborationIds.length === 1 ? "collaboration" : "collaborations"
    } and released the commitment.`,
  };
}
