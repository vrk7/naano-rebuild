import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { MEASUREMENT_WINDOW_DAYS, measurementEndsAt } from "@/lib/collaboration/machine";
import type { CollaborationState } from "@/lib/collaboration/machine";

/**
 * The wallet and its ledger (PRODUCT.md, "Money"; SCOPE.md delivery step 9).
 *
 * No money moves anywhere in this product. A booking writes a negative `commit`
 * and drops the balance; closing writes the positive `release` that gives it
 * back. The balance is a derived number that happens to be stored, and the
 * ledger is the thing that explains it — which is why the page shows both and
 * why every entry names the collaboration it belongs to.
 */

export type LedgerKind = "topup" | "commit" | "release" | "refund";

export type LedgerEntry = {
  readonly id: string;
  readonly kind: LedgerKind;
  /** Signed. Commits are negative; topups and releases positive. */
  readonly amountCents: number;
  readonly at: string;
  readonly collaborationId: string | null;
  readonly creatorName: string | null;
  readonly campaignName: string | null;
  readonly state: CollaborationState | null;
};

export type Wallet = {
  readonly balanceCents: number;
  /** Still held against open bookings — committed but not yet released. */
  readonly committedCents: number;
  readonly entries: ReadonlyArray<LedgerEntry>;
  /** Published collaborations whose measurement window has closed. */
  readonly dueCollaborationIds: ReadonlyArray<string>;
};

/** States where a commit has been settled one way or another. */
const SETTLED: ReadonlySet<CollaborationState> = new Set<CollaborationState>([
  "completed",
  "declined",
  "expired",
  "cancelled",
]);

function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

/**
 * Returns null when the session has no wallet.
 *
 * Not the same as a zero balance, and the page must not render it as one. A
 * workspace is created with an empty wallet, so a missing row means something
 * removed it rather than that the balance is nil — and topping up, which fixes
 * a zero balance, would fail here.
 */
export async function loadWallet(): Promise<Wallet | null> {
  const supabase = await createClient();

  const { data: wallet, error } = await supabase
    .from("wallet")
    .select("id, balance_cents")
    .maybeSingle();

  if (error) throw new Error(`Could not load the wallet: ${error.message}`);
  if (!wallet) return null;

  const rows = await fetchAllRows<{
    id: string;
    kind: string;
    amount_cents: number;
    at: string;
    collaboration_id: string | null;
    collaboration: unknown;
  }>(
    (from, to) =>
      supabase
        .from("ledger_entry")
        .select(
          `id, kind, amount_cents, at, collaboration_id,
           collaboration:collaboration_id (
             state,
             creator:creator_id ( display_name ),
             campaign:campaign_id ( name ),
             post ( published_at )
           )`,
        )
        .eq("wallet_id", wallet.id)
        .order("at", { ascending: false })
        .range(from, to),
    "load ledger",
  );

  const now = new Date();
  const entries: LedgerEntry[] = [];
  const due = new Set<string>();
  let committedCents = 0;

  for (const row of rows) {
    const collaboration = one<{
      state: CollaborationState;
      creator: unknown;
      campaign: unknown;
      post: unknown;
    }>(row.collaboration);

    const state = collaboration?.state ?? null;

    // A commit against a collaboration that has not settled is money still
    // being held. Stored as a negative, reported as a positive amount held.
    if (row.kind === "commit" && state !== null && !SETTLED.has(state)) {
      committedCents += Math.abs(row.amount_cents);
    }

    const post = one<{ published_at: string | null }>(collaboration?.post);
    if (
      row.collaboration_id &&
      state === "published" &&
      post?.published_at &&
      now >= measurementEndsAt(new Date(post.published_at))
    ) {
      due.add(row.collaboration_id);
    }

    entries.push({
      id: row.id,
      kind: row.kind as LedgerKind,
      amountCents: row.amount_cents,
      at: row.at,
      collaborationId: row.collaboration_id,
      creatorName: one<{ display_name: string }>(collaboration?.creator)?.display_name ?? null,
      campaignName: one<{ name: string }>(collaboration?.campaign)?.name ?? null,
      state,
    });
  }

  return {
    balanceCents: wallet.balance_cents as number,
    committedCents,
    entries,
    dueCollaborationIds: [...due],
  };
}

export { MEASUREMENT_WINDOW_DAYS };
