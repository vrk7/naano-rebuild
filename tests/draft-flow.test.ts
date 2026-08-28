import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!session.current) throw new Error("No session set for this test.");
    return session.current;
  },
}));

import { RESPOND_WINDOW_HOURS } from "@/lib/collaboration/machine";
import { loadEvents } from "@/lib/collaboration/queries";
import { applyTransition } from "@/lib/collaboration/transitions";
import { loadDrafts, loadPost, publishPost, submitDraft } from "@/lib/draft/queries";

/**
 * Draft, checks, review, publish — against the real database.
 *
 * SCOPE.md step 7 end to end. Every write in it is several rows that mean
 * nothing apart, so what is under test is the transaction: a draft with no
 * checks reads as a draft that passed, a review that approves without logging
 * loses the history, and a `published` collaboration with no `post` row is a
 * lead source that does not exist.
 *
 * It also pins the evidence rule the migration refined. A deterministic check
 * that fails on an absence stores no span — and must still be allowed to fail,
 * or a brief's required mention could never be enforced.
 */

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasCredentials = Boolean(URL_ENV && ANON_ENV && SERVICE_ENV);

const RUN = `draft-${Date.now()}`;
const PASSWORD = "test-password-not-a-secret";
const PRICE_CENTS = 120_000;

const REQUIREMENTS = {
  must_mention: ["Atira"],
  must_include_link: true,
  banned_claims: ["guaranteed"],
  length: { min: 50 },
  requires_disclosure: true,
};

/** Fails four of the five rules, and passes the one about length. */
const FIRST_DRAFT =
  "A post about quote turnaround, long enough to clear the fifty character minimum, and it says guaranteed.";

const SECOND_DRAFT =
  "Atira cuts quote turnaround from days to hours. The teardown is here: https://atira.example/rfq #ad";

const POST_URL = `https://www.linkedin.com/posts/${RUN}_teardown-activity-7212345678901234567-AbCd`;

function adminClient(): SupabaseClient {
  return createClient(URL_ENV!, SERVICE_ENV!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function must<T>(label: string, result: { data: T | null; error: unknown }): T {
  if (result.error) {
    const detail =
      result.error instanceof Error ? result.error.message : JSON.stringify(result.error);
    throw new Error(`${label}: ${detail}`);
  }
  if (result.data === null) throw new Error(`${label}: no data`);
  return result.data;
}

const admin = hasCredentials ? adminClient() : null;
const created = { users: [] as string[], workspaces: [] as string[], creators: [] as string[] };

let brand: { id: string; client: SupabaseClient; workspaceId: string };
let creator: { id: string; client: SupabaseClient; creatorId: string };
let campaignId: string;
let collaborationId: string;
let secondCollaborationId: string;

async function createUser(tag: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `${RUN}-${tag}@example.test`;
  const { data, error } = await admin!.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  created.users.push(data.user.id);

  const client = createClient(URL_ENV!, ANON_ENV!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`signIn ${email}: ${signIn.error.message}`);

  return { id: data.user.id, client };
}

beforeAll(async () => {
  if (!hasCredentials) return;

  const brandUser = await createUser("brand");
  const [workspace] = must(
    "workspace",
    await admin!.from("workspace").insert({ name: RUN }).select("id"),
  );
  created.workspaces.push(workspace.id);
  must(
    "member",
    await admin!
      .from("workspace_member")
      .insert({ workspace_id: workspace.id, user_id: brandUser.id, role: "owner" })
      .select("id"),
  );
  must(
    "wallet",
    await admin!
      .from("wallet")
      .insert({ workspace_id: workspace.id, balance_cents: 1_000_000 })
      .select("id"),
  );
  brand = { ...brandUser, workspaceId: workspace.id };

  const [campaign] = must(
    "campaign",
    await admin!
      .from("campaign")
      .insert({ workspace_id: workspace.id, name: `${RUN}-campaign`, status: "live" })
      .select("id"),
  );
  campaignId = campaign.id;
  must(
    "brief",
    await admin!
      .from("brief")
      .insert({
        campaign_id: campaignId,
        mode: "specific",
        body: "Talk about what a slow quote costs.",
        requirements: REQUIREMENTS,
      })
      .select("id"),
  );

  const creatorUser = await createUser("creator");
  const [creatorRow] = must(
    "creator",
    await admin!
      .from("creator")
      .insert({
        display_name: `${RUN}-creator`,
        linkedin_url: `https://example.test/in/${RUN}`,
        user_id: creatorUser.id,
      })
      .select("id"),
  );
  created.creators.push(creatorRow.id);
  creator = { ...creatorUser, creatorId: creatorRow.id };

  // Two bookings on one campaign is refused, so the second collaboration —
  // which exists to prove one post cannot be claimed twice — gets its own.
  const book = async (campaign: string) => {
    const { data, error } = await brand.client.rpc("book_creator", {
      p_campaign_id: campaign,
      p_creator_id: creator.creatorId,
      p_price_cents: PRICE_CENTS,
      p_post_by: "2026-12-01",
      p_approval_required: true,
      p_respond_hours: RESPOND_WINDOW_HOURS,
    });
    if (error) throw new Error(`book: ${error.message}`);
    return data as string;
  };

  collaborationId = await book(campaignId);

  const [second] = must(
    "second campaign",
    await admin!
      .from("campaign")
      .insert({ workspace_id: workspace.id, name: `${RUN}-campaign-2`, status: "live" })
      .select("id"),
  );
  must(
    "second brief",
    await admin!
      .from("brief")
      .insert({ campaign_id: second.id, mode: "creative_freedom", body: "Your take." })
      .select("id"),
  );
  secondCollaborationId = await book(second.id);

  // Both start invited; the drafting path needs them accepted.
  session.current = creator.client;
  for (const id of [collaborationId, secondCollaborationId]) {
    const accepted = await applyTransition(id, { kind: "accept" });
    if (accepted.kind !== "ok") throw new Error(`accept: ${accepted.reason}`);
  }
});

afterAll(async () => {
  if (!hasCredentials || !admin) return;
  for (const id of created.workspaces) await admin.from("workspace").delete().eq("id", id);
  for (const id of created.creators) await admin.from("creator").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
});

describe.skipIf(!hasCredentials)("submitting a draft", () => {
  it("refuses a brand submitting on the creator's behalf", async () => {
    session.current = brand.client;
    const result = await submitDraft(collaborationId, SECOND_DRAFT);

    expect(result).toEqual({ kind: "refused", reason: expect.stringMatching(/only the creator/i) });
    expect(await loadDrafts(collaborationId)).toHaveLength(0);
  });

  it("writes the version, its checks and the state change together", async () => {
    session.current = creator.client;
    const result = await submitDraft(collaborationId, FIRST_DRAFT);

    expect(result).toEqual({ kind: "ok", value: { version: 1, state: "in_review" } });

    const [draft] = await loadDrafts(collaborationId);
    expect(draft.version).toBe(1);
    expect(draft.checks).toHaveLength(5);

    const [collaboration] = must(
      "collaboration",
      await admin!.from("collaboration").select("state").eq("id", collaborationId),
    );
    expect(collaboration.state).toBe("in_review");
  });

  /**
   * The rule the migration refined. A required mention that is absent has no
   * span to quote, and citing the opening line instead would be evidence for a
   * claim it is not evidence for — so it fails with none.
   */
  it("lets a deterministic check fail on an absence, with no evidence", async () => {
    session.current = creator.client;
    const [draft] = await loadDrafts(collaborationId);

    const mention = draft.checks.find((check) => check.ruleKey === "must_mention")!;
    expect(mention.status).toBe("fail");
    expect(mention.evidence).toBeNull();
    expect(mention.explanation).toContain("Atira");

    // The one failure that always has a span, because the claim is in the text.
    const banned = draft.checks.find((check) => check.ruleKey === "banned_claims")!;
    expect(banned.status).toBe("fail");
    expect(banned.evidence).toContain("guaranteed");

    // And the rule this draft does satisfy.
    expect(draft.checks.find((check) => check.ruleKey === "length")!.status).toBe("pass");
  });

  /** Failing checks do not block the submit: the brand is entitled to see them. */
  it("submitted a draft that fails its own brief", async () => {
    session.current = creator.client;
    const [draft] = await loadDrafts(collaborationId);
    expect(draft.checks.filter((check) => check.status === "fail")).toHaveLength(4);
  });
});

describe.skipIf(!hasCredentials)("review", () => {
  it("refuses to send it back without a note", async () => {
    session.current = brand.client;
    const result = await applyTransition(collaborationId, { kind: "request_changes", note: "  " });

    expect(result).toEqual({ kind: "refused", reason: expect.stringMatching(/note/i) });
  });

  it("sends it back with one, and the note is the log entry", async () => {
    session.current = brand.client;
    const result = await applyTransition(collaborationId, {
      kind: "request_changes",
      note: "Mention Atira by name and add the disclosure.",
    });
    expect(result).toEqual({ kind: "ok", state: "changes_requested" });

    const events = await loadEvents(collaborationId);
    const sentBack = events.at(-1)!;
    expect(sentBack.toState).toBe("changes_requested");
    expect(sentBack.actor).toBe("brand");
    expect(sentBack.note).toBe("Mention Atira by name and add the disclosure.");
  });

  /**
   * Resubmitting is two transitions, and the log gets both: PRODUCT.md routes a
   * revision back through `drafting` rather than jumping straight to review.
   */
  it("takes a second version through drafting on the way back", async () => {
    session.current = creator.client;
    const result = await submitDraft(collaborationId, SECOND_DRAFT);
    expect(result).toEqual({ kind: "ok", value: { version: 2, state: "in_review" } });

    const drafts = await loadDrafts(collaborationId);
    expect(drafts.map((draft) => draft.version)).toEqual([2, 1]);
    // The rewrite satisfies every rule this time.
    expect(drafts[0].checks.filter((check) => check.status === "fail")).toHaveLength(0);

    const states = (await loadEvents(collaborationId)).map((event) => event.toState);
    expect(states.slice(-3)).toEqual(["changes_requested", "drafting", "in_review"]);
  });

  it("approves", async () => {
    session.current = brand.client;
    expect(await applyTransition(collaborationId, { kind: "approve" })).toEqual({
      kind: "ok",
      state: "approved",
    });
  });
});

describe.skipIf(!hasCredentials)("publishing", () => {
  it("records the post and the creator's own row for it", async () => {
    session.current = creator.client;
    const result = await publishPost(collaborationId, POST_URL);
    expect(result.kind).toBe("ok");

    const [collaboration] = must(
      "collaboration",
      await admin!.from("collaboration").select("state").eq("id", collaborationId),
    );
    expect(collaboration.state).toBe("published");

    const [creatorPost] = must(
      "creator_post",
      await admin!
        .from("creator_post")
        .select("external_url, is_sponsored, body, collaboration_id")
        .eq("collaboration_id", collaborationId),
    );
    expect(creatorPost.external_url).toBe(POST_URL);
    expect(creatorPost.is_sponsored).toBe(true);
    // The approved draft, not the live post: we cannot read the page, and
    // claiming to have its text would invent the one thing this record is for.
    expect(creatorPost.body).toBe(SECOND_DRAFT);

    const post = await loadPost(collaborationId);
    expect(post?.externalUrl).toBe(POST_URL);
  });

  /** `creator_post.external_url` is unique, so one post cannot bring leads twice. */
  it("refuses the same URL on another collaboration", async () => {
    session.current = creator.client;

    // Take the second collaboration to `approved` first: it has no requirements
    // at all, so its checks pass vacuously.
    const submitted = await submitDraft(secondCollaborationId, "A short take.");
    expect(submitted.kind).toBe("ok");
    const [draft] = await loadDrafts(secondCollaborationId);
    expect(draft.checks).toEqual([]);

    session.current = brand.client;
    expect((await applyTransition(secondCollaborationId, { kind: "approve" })).kind).toBe("ok");

    session.current = creator.client;
    const result = await publishPost(secondCollaborationId, POST_URL);
    expect(result).toEqual({
      kind: "refused",
      reason: expect.stringMatching(/already recorded/i),
    });

    // The refusal took the state with it: nothing half-published.
    const [collaboration] = must(
      "collaboration",
      await admin!.from("collaboration").select("state").eq("id", secondCollaborationId),
    );
    expect(collaboration.state).toBe("approved");
  });
});
