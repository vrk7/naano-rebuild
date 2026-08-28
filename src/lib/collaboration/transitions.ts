/**
 * The one place a collaboration changes state.
 *
 * Three steps, in this order: work out who is asking, ask the machine, then
 * write. The machine (`machine.ts`) decides legality and produces the events;
 * this file supplies it with the row and the session and hands the result to
 * `apply_collaboration_transition`, which lands the state change and its log
 * entries in a single transaction.
 *
 * The actor is derived from the session rather than passed in. A caller saying
 * "I am the creator" is a claim, and the difference between the two sides is
 * exactly what half of PRODUCT.md's guards turn on.
 */

import { createClient } from "@/lib/supabase/server";
import {
  transition,
  type Action,
  type Actor,
  type CollaborationSnapshot,
  type CollaborationState,
  type TransitionStep,
} from "./machine";

export type TransitionResult =
  | { readonly kind: "ok"; readonly state: CollaborationState }
  | { readonly kind: "refused"; readonly reason: string };

export type CollaborationRow = {
  readonly id: string;
  readonly campaignId: string;
  readonly workspaceId: string;
  readonly creatorId: string;
  readonly snapshot: CollaborationSnapshot;
};

async function loadRow(collaborationId: string): Promise<CollaborationRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collaboration")
    .select(
      "id, campaign_id, workspace_id, creator_id, state, respond_by, approval_required, post ( published_at )",
    )
    .eq("id", collaborationId)
    .maybeSingle();

  if (error) throw new Error(`Could not load that collaboration: ${error.message}`);
  // Absent means no such row, or one this session may not see. Both end here.
  if (!data) return null;

  const post = (Array.isArray(data.post) ? data.post[0] : data.post) as
    | { published_at: string | null }
    | null;

  return {
    id: data.id as string,
    campaignId: data.campaign_id as string,
    workspaceId: data.workspace_id as string,
    creatorId: data.creator_id as string,
    snapshot: {
      state: data.state as CollaborationState,
      respondBy: data.respond_by ? new Date(data.respond_by as string) : null,
      approvalRequired: data.approval_required as boolean,
      publishedAt: post?.published_at ? new Date(post.published_at) : null,
    },
  };
}

/**
 * Which side of this collaboration the session is on.
 *
 * RLS lets both through, so being able to read the row proves only that the
 * caller is one of the two. Creator first, because a creator is never also the
 * booking workspace and the check is a single indexed lookup. `system` is not
 * derivable from a session and is never returned here.
 */
async function actorFor(row: CollaborationRow): Promise<Actor | null> {
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) throw new Error(`Could not read the session: ${claimsError.message}`);

  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return null;

  const { data: creator, error: creatorError } = await supabase
    .from("creator")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (creatorError) throw new Error(`Could not resolve your creator: ${creatorError.message}`);
  if (creator && creator.id === row.creatorId) return "creator";

  // Returns a row only for a workspace this session is a member of.
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspace")
    .select("id")
    .eq("id", row.workspaceId)
    .maybeSingle();

  if (workspaceError) throw new Error(`Could not resolve your workspace: ${workspaceError.message}`);
  if (workspace) return "brand";

  return null;
}

export type TransitionPlan =
  | {
      readonly kind: "ok";
      readonly steps: ReadonlyArray<TransitionStep>;
      readonly state: CollaborationState;
      readonly row: CollaborationRow;
    }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * What the machine says, without writing it.
 *
 * Split out because two of the transitions are not the only thing their request
 * writes: submitting a draft writes the draft and its checks first, and
 * publishing writes the post. Those go through their own function so everything
 * lands in one transaction, and this is how they get the steps to hand it.
 *
 * Takes a list of actions because a creator resubmitting after changes does two
 * things at once — reopens the draft, then submits it — and PRODUCT.md gives
 * those two separate rows in the log. Each action is decided against the state
 * the one before it left behind.
 */
export async function planTransition(
  collaborationId: string,
  /**
   * A list, or a function of the state the row is actually in. The second form
   * exists for one case: a creator resubmitting after changes reopens the draft
   * first, and only the loaded row knows whether that step is needed.
   */
  actions: ReadonlyArray<Action> | ((state: CollaborationState) => ReadonlyArray<Action>),
  now: Date = new Date(),
): Promise<TransitionPlan> {
  const row = await loadRow(collaborationId);
  if (!row) return { kind: "refused", reason: "That collaboration is not one you can see." };

  const by = await actorFor(row);
  if (by === null) {
    return { kind: "refused", reason: "This account is neither side of that collaboration." };
  }

  const steps: TransitionStep[] = [];
  let snapshot = row.snapshot;
  const wanted = typeof actions === "function" ? actions(row.snapshot.state) : actions;

  for (const action of wanted) {
    const decided = transition(snapshot, action, { now, by });
    if (decided.kind === "refused") return decided;
    steps.push(...decided.steps);
    snapshot = { ...snapshot, state: decided.state };
  }

  return { kind: "ok", steps, state: snapshot.state, row };
}

/** The steps as `apply_collaboration_transition` and its callers want them. */
export function stepsForRpc(
  steps: ReadonlyArray<TransitionStep>,
): Array<{ from: string; to: string; actor: string; note: string | null }> {
  return steps.map((step) => ({
    from: step.from,
    to: step.to,
    actor: step.actor,
    note: step.note,
  }));
}

export async function applyTransition(
  collaborationId: string,
  action: Action,
  now: Date = new Date(),
): Promise<TransitionResult> {
  const decided = await planTransition(collaborationId, [action], now);
  if (decided.kind === "refused") return decided;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_collaboration_transition", {
    p_collaboration_id: collaborationId,
    p_steps: stepsForRpc(decided.steps),
  });

  if (error) {
    /*
     * The row moved between the read above and the write. Somebody else got
     * there first — the brand cancelled while the creator was accepting — which
     * is a refusal to show, not a fault to throw.
     */
    if (error.hint === "stale_state") {
      return {
        kind: "refused",
        reason: "This collaboration changed while you were looking at it. Reload and try again.",
      };
    }
    throw new Error(`Could not move this collaboration: ${error.message}`);
  }

  if (data !== decided.state) {
    // The function returns the state it left the row in. Disagreeing with the
    // machine means one of them is wrong, and carrying on would write the next
    // transition against a row we have mis-modelled.
    throw new Error(
      `Collaboration ${collaborationId} ended in ${String(data)}, but the machine expected ${decided.state}.`,
    );
  }

  return { kind: "ok", state: decided.state };
}
