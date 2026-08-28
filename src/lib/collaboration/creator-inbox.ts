/**
 * The creator's side of a collaboration (PRODUCT.md step 8).
 *
 * RLS resolves `auth.uid()` to a creator and returns only the collaborations
 * that creator is named on, so nothing here filters by creator id.
 *
 * What a creator can see is narrower than what a brand can, on purpose. The
 * campaign is workspace-scoped with no creator-side policy: the brief is the
 * one piece of it that crosses, and only for a campaign they have been booked
 * on. So an invitation carries its terms and its brief, and does not name the
 * brand behind it.
 */

import { createClient } from "@/lib/supabase/server";
import { isBriefMode, type BriefMode } from "@/lib/campaign/parse";
import { parseStoredRequirements, type BriefRequirements } from "@/lib/campaign/requirements";
import type { CollaborationState } from "./machine";

export type CreatorCollaboration = {
  readonly id: string;
  readonly state: CollaborationState;
  readonly priceCents: number;
  readonly postBy: string | null;
  readonly respondBy: string | null;
  readonly approvalRequired: boolean;
  readonly createdAt: string;
};

export type CreatorCollaborationDetail = CreatorCollaboration & {
  readonly brief: {
    readonly mode: BriefMode;
    readonly body: string | null;
    readonly requirements: BriefRequirements;
  } | null;
};

const SELECT = "id, state, price_cents, post_by, respond_by, approval_required, created_at";

type Row = {
  id: string;
  state: string;
  price_cents: number;
  post_by: string | null;
  respond_by: string | null;
  approval_required: boolean;
  created_at: string;
};

function shape(row: Row): CreatorCollaboration {
  return {
    id: row.id,
    state: row.state as CollaborationState,
    priceCents: row.price_cents,
    postBy: row.post_by,
    respondBy: row.respond_by,
    approvalRequired: row.approval_required,
    createdAt: row.created_at,
  };
}

export async function loadCreatorCollaborations(): Promise<CreatorCollaboration[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collaboration")
    .select(SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load your collaborations: ${error.message}`);
  if (!data) throw new Error("Collaboration query returned no data");

  return (data as Row[]).map(shape);
}

/** One collaboration and the brief it was booked against. Null when there is no such row. */
export async function loadCreatorCollaboration(
  collaborationId: string,
): Promise<CreatorCollaborationDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collaboration")
    .select(`${SELECT}, campaign_id`)
    .eq("id", collaborationId)
    .maybeSingle();

  if (error) throw new Error(`Could not load that collaboration: ${error.message}`);
  if (!data) return null;

  const row = data as Row & { campaign_id: string };

  /*
   * Fetched by campaign id rather than joined through `campaign`, which a
   * creator cannot select at all. The brief's own policy grants this read to a
   * creator booked on the campaign, so the join would fail where this succeeds.
   */
  const { data: brief, error: briefError } = await supabase
    .from("brief")
    .select("mode, body, requirements")
    .eq("campaign_id", row.campaign_id)
    .maybeSingle();

  if (briefError) throw new Error(`Could not load the brief: ${briefError.message}`);

  const mode = brief && isBriefMode(brief.mode) ? (brief.mode as BriefMode) : null;

  return {
    ...shape(row),
    // A brief whose mode is not one of the two is a broken row, not a third
    // mode. The page says so rather than rendering rules it cannot name.
    brief:
      brief && mode
        ? {
            mode,
            body: (brief.body ?? null) as string | null,
            requirements: parseStoredRequirements(brief.requirements),
          }
        : null,
  };
}
