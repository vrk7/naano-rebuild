/**
 * Booking, and the brand's view of what it has booked (PRODUCT.md step 7).
 *
 * The booking itself is one `rpc` call. Everything it writes — the
 * collaboration, its first event, the `commit` ledger entry and the wallet
 * balance — lands in a single transaction, because PostgREST has none of its
 * own and money that half-lands is worse than a booking that fails. The
 * function's own comment carries the rest of that argument.
 *
 * Reads run as the signed-in user, so RLS decides what comes back and nothing
 * here compares a workspace id.
 */

import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/posts/metrics";
import { isBriefMode, type BriefMode } from "@/lib/campaign/parse";
import { parseStoredRequirements, type BriefRequirements } from "@/lib/campaign/requirements";
import { RESPOND_WINDOW_HOURS, isOpen, type CollaborationState } from "./machine";
import type { BookingInput } from "./booking";

export type BookingResult =
  | { readonly kind: "ok"; readonly collaborationId: string }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * The refusals `book_creator` raises, by the tag it puts in the error hint.
 *
 * Matching on a tag rather than on the message means the wording can change on
 * either side without the other silently falling through to "something went
 * wrong". Anything not in here is not a refusal — it is a fault, and it throws.
 */
const REFUSALS: Readonly<Record<string, string>> = {
  no_campaign: "That campaign is not one this workspace can book against.",
  no_creator: "That creator is no longer listed.",
  no_price: "A booking commits a price.",
  no_respond_window: "A booking needs a window for the creator to answer in.",
  post_by_passed: "That post date has already passed.",
  already_booked: "This creator is already booked on this campaign.",
  no_wallet: "This workspace has no wallet, so nothing can be committed against it.",
};

export async function bookCreator(
  campaignId: string,
  creatorId: string,
  input: BookingInput,
): Promise<BookingResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("book_creator", {
    p_campaign_id: campaignId,
    p_creator_id: creatorId,
    p_price_cents: input.priceCents,
    p_post_by: input.postBy,
    p_approval_required: input.approvalRequired,
    p_respond_hours: RESPOND_WINDOW_HOURS,
  });

  if (error) {
    const hint = error.hint ?? "";

    /*
     * The one refusal that needs numbers in it. The function's own message
     * carries raw cents, so the balance is re-read and formatted here instead —
     * a brand being told they cannot afford something deserves to be told what
     * they have.
     */
    if (hint === "insufficient_funds") {
      const balance = await loadWalletBalance();
      return {
        kind: "refused",
        reason:
          `This booking commits ${formatCents(input.priceCents)} and the wallet holds ` +
          `${balance === null ? "nothing" : formatCents(balance)}. Topping up is not built yet.`,
      };
    }

    if (hint in REFUSALS) return { kind: "refused", reason: REFUSALS[hint] };

    throw new Error(`Could not book this creator: ${error.message}`);
  }

  if (typeof data !== "string") {
    throw new Error("Booking returned no collaboration id.");
  }

  return { kind: "ok", collaborationId: data };
}

/**
 * The workspace's wallet balance, or null when it has no wallet.
 *
 * Null is a real answer and a different one from zero: a workspace with no
 * wallet cannot commit anything, and telling it the balance is $0 would suggest
 * a top-up would fix it.
 */
export async function loadWalletBalance(): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("wallet").select("balance_cents").maybeSingle();

  if (error) throw new Error(`Could not read the wallet: ${error.message}`);
  return data ? Number(data.balance_cents) : null;
}

export type BookingTarget = {
  readonly creator: {
    readonly id: string;
    readonly displayName: string;
    readonly headline: string | null;
    readonly priceCents: number | null;
  };
  /** An existing collaboration between this campaign and this creator that has not ended. */
  readonly existing: { readonly id: string; readonly state: CollaborationState } | null;
  readonly walletBalanceCents: number | null;
};

/** Everything the booking form needs to open: who, at what rate, and against what balance. */
export async function loadBookingTarget(
  campaignId: string,
  creatorId: string,
): Promise<BookingTarget | null> {
  const supabase = await createClient();

  const { data: creator, error } = await supabase
    .from("creator")
    .select("id, display_name, headline, creator_rate ( price_cents, kind )")
    .eq("id", creatorId)
    .maybeSingle();

  if (error) throw new Error(`Could not load that creator: ${error.message}`);
  if (!creator) return null;

  const { data: existing, error: existingError } = await supabase
    .from("collaboration")
    .select("id, state")
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (existingError) {
    throw new Error(`Could not check for an existing booking: ${existingError.message}`);
  }

  const rates = (creator.creator_rate ?? []) as Array<{ price_cents: number; kind: string }>;
  const single = rates.find((rate) => rate.kind === "single");
  const live = (existing ?? []).find((row) => isOpen(row.state as CollaborationState));

  return {
    creator: {
      id: creator.id as string,
      displayName: creator.display_name as string,
      headline: (creator.headline ?? null) as string | null,
      priceCents: single ? single.price_cents : null,
    },
    existing: live ? { id: live.id as string, state: live.state as CollaborationState } : null,
    walletBalanceCents: await loadWalletBalance(),
  };
}

export type CampaignCollaboration = {
  readonly id: string;
  readonly state: CollaborationState;
  readonly priceCents: number;
  readonly postBy: string | null;
  readonly respondBy: string | null;
  readonly approvalRequired: boolean;
  readonly createdAt: string;
  readonly creator: { readonly id: string; readonly displayName: string };
};

/** Who this campaign has booked, newest first. RLS keeps it to this workspace. */
export async function loadCampaignCollaborations(
  campaignId: string,
): Promise<CampaignCollaboration[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collaboration")
    .select(
      "id, state, price_cents, post_by, respond_by, approval_required, created_at, creator ( id, display_name )",
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load collaborations: ${error.message}`);
  if (!data) throw new Error("Collaboration query returned no data");

  return data.map((row) => {
    // `creator` is a to-one relation, which PostgREST may hand back either way.
    const creator = (Array.isArray(row.creator) ? row.creator[0] : row.creator) as {
      id: string;
      display_name: string;
    } | null;

    if (!creator) {
      // creator_id is not null and `creator` is readable by anyone signed in,
      // so an absent join means the shape changed underneath us.
      throw new Error(`Collaboration ${row.id} came back without its creator.`);
    }

    return {
      id: row.id as string,
      state: row.state as CollaborationState,
      priceCents: row.price_cents as number,
      postBy: (row.post_by ?? null) as string | null,
      respondBy: (row.respond_by ?? null) as string | null,
      approvalRequired: row.approval_required as boolean,
      createdAt: row.created_at as string,
      creator: { id: creator.id, displayName: creator.display_name },
    };
  });
}

export type CollaborationDetail = CampaignCollaboration & {
  readonly campaign: { readonly id: string; readonly name: string };
  readonly brief: {
    readonly mode: BriefMode;
    readonly body: string | null;
    readonly requirements: BriefRequirements;
  } | null;
};

/**
 * One collaboration, as the brand sees it.
 *
 * The campaign and its brief come along because the review screen judges a
 * draft against them — a brand approving a post without the rules it was
 * written to is guessing.
 */
export async function loadCollaboration(
  collaborationId: string,
): Promise<CollaborationDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collaboration")
    .select(
      "id, state, price_cents, post_by, respond_by, approval_required, created_at, campaign_id, creator ( id, display_name ), campaign ( id, name, brief ( mode, body, requirements ) )",
    )
    .eq("id", collaborationId)
    .maybeSingle();

  if (error) throw new Error(`Could not load that collaboration: ${error.message}`);
  // Absent means no such row, or one this session may not see. Both end here.
  if (!data) return null;

  const one = <T,>(value: unknown): T | null =>
    (Array.isArray(value) ? (value[0] as T) : (value as T)) ?? null;

  const creator = one<{ id: string; display_name: string }>(data.creator);
  const campaign = one<{ id: string; name: string; brief: unknown }>(data.campaign);

  if (!creator || !campaign) {
    // Both are non-null foreign keys. An absent join means the shape changed,
    // or — for the campaign — that a creator reached a brand-side loader, which
    // has no policy to read it.
    throw new Error(`Collaboration ${collaborationId} came back without its creator or campaign.`);
  }

  const brief = one<{ mode: string; body: string | null; requirements: unknown }>(campaign.brief);

  return {
    id: data.id as string,
    state: data.state as CollaborationState,
    priceCents: data.price_cents as number,
    postBy: (data.post_by ?? null) as string | null,
    respondBy: (data.respond_by ?? null) as string | null,
    approvalRequired: data.approval_required as boolean,
    createdAt: data.created_at as string,
    creator: { id: creator.id, displayName: creator.display_name },
    campaign: { id: campaign.id, name: campaign.name },
    brief:
      brief && isBriefMode(brief.mode)
        ? {
            mode: brief.mode,
            body: brief.body,
            requirements: parseStoredRequirements(brief.requirements),
          }
        : null,
  };
}

export type CollaborationEvent = {
  readonly id: string;
  readonly fromState: CollaborationState | null;
  readonly toState: CollaborationState;
  readonly actor: string;
  readonly note: string | null;
  readonly at: string;
};

/**
 * The append-only log, oldest first.
 *
 * PRODUCT.md keeps `collaboration_event` as the history, and the
 * request-changes note lives nowhere else — SCOPE.md cuts messaging, so this is
 * the only channel a brand has for saying what is wrong.
 */
export async function loadEvents(collaborationId: string): Promise<CollaborationEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collaboration_event")
    .select("id, from_state, to_state, actor, note, at")
    .eq("collaboration_id", collaborationId)
    .order("at", { ascending: true });

  if (error) throw new Error(`Could not load the history: ${error.message}`);
  if (!data) throw new Error("Event query returned no data");

  return data.map((row) => ({
    id: row.id as string,
    fromState: (row.from_state ?? null) as CollaborationState | null,
    toState: row.to_state as CollaborationState,
    actor: row.actor as string,
    note: (row.note ?? null) as string | null,
    at: row.at as string,
  }));
}

/** The note the brand sent back with, if the last thing that happened was that. */
export function latestChangeNote(
  events: ReadonlyArray<CollaborationEvent>,
): CollaborationEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].toState === "changes_requested") return events[index];
  }
  return null;
}
