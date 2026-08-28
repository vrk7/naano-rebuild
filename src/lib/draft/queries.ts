/**
 * Drafts, their checks, and the post at the end of it
 * (PRODUCT.md steps 9 to 11).
 *
 * Every write here is one `rpc` call, because every one of them is several rows
 * that mean nothing apart: a draft with no checks reads as a draft that passed,
 * and a `published` collaboration with no `post` row is a lead source that does
 * not exist. The state change goes in the same transaction, so neither can be
 * true without the other.
 *
 * What moves the collaboration is still decided by the machine — `planTransition`
 * returns the steps and these functions hand them along.
 */

import { parseStoredRequirements, type BriefRequirements } from "@/lib/campaign/requirements";
import { planTransition, stepsForRpc } from "@/lib/collaboration/transitions";
import type { CollaborationState } from "@/lib/collaboration/machine";
import { createClient } from "@/lib/supabase/server";
import { runDeterministicChecks, type CheckStatus } from "./checks";

export type StoredCheck = {
  readonly ruleKey: string;
  readonly ruleLabel: string;
  readonly kind: string;
  readonly status: CheckStatus;
  readonly evidence: string | null;
  readonly explanation: string | null;
};

export type DraftVersion = {
  readonly id: string;
  readonly version: number;
  readonly body: string;
  readonly submittedAt: string;
  readonly checks: ReadonlyArray<StoredCheck>;
};

export type WriteResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "refused"; readonly reason: string };

const REFUSALS: Readonly<Record<string, string>> = {
  no_body: "Write the post before submitting it.",
  no_url: "Paste the link to your published post.",
  not_found: "That collaboration is not one you can publish.",
  post_already_recorded: "That post URL is already recorded against a collaboration.",
  stale_state:
    "This collaboration changed while you were looking at it. Reload and try again.",
};

/**
 * Every version, newest first.
 *
 * History rather than a single current draft: PRODUCT.md gives `draft` a
 * version per submission, and a creator who was sent back deserves to see what
 * they wrote last time next to the note about it.
 */
export async function loadDrafts(collaborationId: string): Promise<DraftVersion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("draft")
    .select(
      "id, version, body, submitted_at, draft_check ( rule_key, rule_label, kind, status, evidence, explanation )",
    )
    .eq("collaboration_id", collaborationId)
    .order("version", { ascending: false });

  if (error) throw new Error(`Could not load the drafts: ${error.message}`);
  if (!data) throw new Error("Draft query returned no data");

  return data.map((row) => ({
    id: row.id as string,
    version: row.version as number,
    body: row.body as string,
    submittedAt: row.submitted_at as string,
    checks: ((row.draft_check ?? []) as Array<Record<string, unknown>>).map((check) => ({
      ruleKey: check.rule_key as string,
      ruleLabel: check.rule_label as string,
      kind: check.kind as string,
      status: check.status as CheckStatus,
      evidence: (check.evidence ?? null) as string | null,
      explanation: (check.explanation ?? null) as string | null,
    })),
  }));
}

/** The brief a draft is measured against. */
async function loadRequirements(campaignId: string): Promise<BriefRequirements> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brief")
    .select("requirements")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) throw new Error(`Could not load the brief: ${error.message}`);
  // No brief means no rules, which is a real answer — `creative_freedom` stores
  // `{}` and every check passes vacuously either way.
  return data ? parseStoredRequirements(data.requirements) : {};
}

export type Submission = {
  readonly version: number;
  readonly state: CollaborationState;
};

/**
 * Submitting a draft (PRODUCT.md step 9).
 *
 * The checks run here, before the state moves, so "the creator sees failures
 * before the brand does" is a property of the write rather than of the UI: by
 * the time the collaboration is in review, its checks are already rows.
 *
 * Failing checks do not block the submission. PRODUCT.md has the creator see
 * them and revise, and a brand who asked to approve the draft is entitled to
 * see one that fails its own brief — refusing the submit would hide that.
 */
export async function submitDraft(
  collaborationId: string,
  body: string,
): Promise<WriteResult<Submission>> {
  const plan = await planTransition(collaborationId, (state) =>
    // Reopening first is the creator's own step in PRODUCT.md's table, and the
    // log gets both rows rather than one that skips a state.
    state === "changes_requested"
      ? [{ kind: "revise" }, { kind: "submit_draft" }]
      : [{ kind: "submit_draft" }],
  );
  if (plan.kind === "refused") return plan;

  const checks = runDeterministicChecks(body, await loadRequirements(plan.row.campaignId));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_draft", {
    p_collaboration_id: collaborationId,
    p_body: body,
    p_checks: checks,
    p_steps: stepsForRpc(plan.steps),
  });

  if (error) {
    const refusal = error.hint ? REFUSALS[error.hint] : undefined;
    if (refusal) return { kind: "refused", reason: refusal };
    throw new Error(`Could not submit that draft: ${error.message}`);
  }

  if (typeof data !== "number") throw new Error("Submitting the draft returned no version.");
  return { kind: "ok", value: { version: data, state: plan.state } };
}

export type PublishedPost = {
  readonly externalUrl: string;
  readonly publishedAt: string;
};

export async function loadPost(collaborationId: string): Promise<PublishedPost | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("post")
    .select("published_at, creator_post ( external_url )")
    .eq("collaboration_id", collaborationId)
    .maybeSingle();

  if (error) throw new Error(`Could not load the post: ${error.message}`);
  if (!data) return null;

  const creatorPost = (Array.isArray(data.creator_post) ? data.creator_post[0] : data.creator_post) as
    | { external_url: string }
    | null;

  if (!creatorPost) {
    // `post.creator_post_id` is not null and readable to both sides, so an
    // absent join means the shape changed underneath us.
    throw new Error(`Post for collaboration ${collaborationId} came back without its creator post.`);
  }

  return { externalUrl: creatorPost.external_url, publishedAt: data.published_at as string };
}

/**
 * Publishing (PRODUCT.md step 11).
 *
 * The creator posts to LinkedIn themselves and pastes the link — SCOPE.md cuts
 * any API — so the URL is the only evidence the post exists. The body stored on
 * `creator_post` is the approved draft rather than the live post: we cannot read
 * the page, and claiming to have its text would be inventing the one thing this
 * record is for.
 */
export async function publishPost(
  collaborationId: string,
  externalUrl: string,
): Promise<WriteResult<string>> {
  const plan = await planTransition(collaborationId, [{ kind: "publish", externalUrl }]);
  if (plan.kind === "refused") return plan;

  const [latest] = await loadDrafts(collaborationId);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_collaboration", {
    p_collaboration_id: collaborationId,
    p_external_url: externalUrl,
    p_body: latest?.body ?? null,
    p_steps: stepsForRpc(plan.steps),
  });

  if (error) {
    const refusal = error.hint ? REFUSALS[error.hint] : undefined;
    if (refusal) return { kind: "refused", reason: refusal };
    throw new Error(`Could not record that post: ${error.message}`);
  }

  if (typeof data !== "string") throw new Error("Publishing returned no post id.");
  return { kind: "ok", value: data };
}
