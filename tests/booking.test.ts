import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { RESPOND_WINDOW_HOURS } from "@/lib/collaboration/machine";
import { loadCreatorCollaboration, loadCreatorCollaborations } from "@/lib/collaboration/creator-inbox";
import { bookCreator, loadBookingTarget, loadCampaignCollaborations, loadWalletBalance } from "@/lib/collaboration/queries";
import { applyTransition } from "@/lib/collaboration/transitions";

/**
 * The app's Supabase client is per-request and reads cookies, which do not
 * exist here. Swapping it for a signed-in client lets the query modules run
 * against the real database exactly as they do in a request — same select
 * strings, same RLS, same mapping — which is the half of them no unit test
 * reaches.
 */
const session = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!session.current) throw new Error("No session set for this test.");
    return session.current;
  },
}));

/**
 * `book_creator` and `apply_collaboration_transition`, against the real
 * database.
 *
 * Both functions exist because PostgREST has no cross-statement transaction,
 * and what they guarantee — money and its ledger entry landing together, a
 * state change and its event landing together, a guard that survives two
 * clicks — is only true in Postgres. A mock would test the mock.
 *
 * The pure decision layer is tested separately and without a network in
 * `collaboration-machine.test.ts`. What is here is the half that file cannot
 * reach: the writes, and the access control on top of them.
 *
 * Every row created here carries a run-scoped prefix and is deleted afterwards.
 */

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasCredentials = Boolean(URL_ENV && ANON_ENV && SERVICE_ENV);

const RUN = `book-${Date.now()}`;
const PASSWORD = "test-password-not-a-secret";

const WALLET_CENTS = 500_000;
const PRICE_CENTS = 150_000;

function adminClient(): SupabaseClient {
  return createClient(URL_ENV!, SERVICE_ENV!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** A client carrying one user's session, so RLS applies as it would in the app. */
function userClient(accessToken: string): SupabaseClient {
  return createClient(URL_ENV!, ANON_ENV!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
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

type Brand = {
  userId: string;
  token: string;
  client: SupabaseClient;
  workspaceId: string;
  walletId: string;
};

let brand: Brand;
/** A second workspace, so "not your campaign" is a real crossing and not an absent row. */
let outsider: Brand;
let creatorId: string;
let creatorUserId: string;
let creatorToken: string;
let creatorClient: SupabaseClient;
let campaigns: { alpha: string; beta: string; gamma: string; delta: string };

async function createUser(
  tag: string,
): Promise<{ id: string; token: string; client: SupabaseClient }> {
  const email = `${RUN}-${tag}@example.test`;
  const { data, error } = await admin!.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  created.users.push(data.user.id);

  const anon = createClient(URL_ENV!, ANON_ENV!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`signIn ${email}: ${signIn.error.message}`);
  // `anon` now holds the session, so both PostgREST and auth.getClaims() work
  // on it — the second is what transitions.ts resolves the actor from.
  return { id: data.user.id, token: signIn.data.session!.access_token, client: anon };
}

async function buildBrand(tag: string, walletCents: number): Promise<Brand> {
  const user = await createUser(tag);

  const [workspace] = must(
    "workspace",
    await admin!.from("workspace").insert({ name: `${RUN}-${tag}` }).select("id"),
  );
  created.workspaces.push(workspace.id);

  must(
    "member",
    await admin!
      .from("workspace_member")
      .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" })
      .select("id"),
  );

  const [wallet] = must(
    "wallet",
    await admin!
      .from("wallet")
      .insert({ workspace_id: workspace.id, balance_cents: walletCents })
      .select("id"),
  );

  return {
    userId: user.id,
    token: user.token,
    client: user.client,
    workspaceId: workspace.id,
    walletId: wallet.id,
  };
}

async function createCampaign(workspaceId: string, name: string): Promise<string> {
  const [campaign] = must(
    "campaign",
    await admin!
      .from("campaign")
      .insert({ workspace_id: workspaceId, name: `${RUN}-${name}`, status: "live" })
      .select("id"),
  );
  must(
    "brief",
    await admin!
      .from("brief")
      .insert({ campaign_id: campaign.id, mode: "creative_freedom", body: "Your take." })
      .select("id"),
  );
  return campaign.id as string;
}

/** The one call the booking screen makes. */
function book(
  client: SupabaseClient,
  campaignId: string,
  overrides: { priceCents?: number; postBy?: string; approvalRequired?: boolean } = {},
) {
  return client.rpc("book_creator", {
    p_campaign_id: campaignId,
    p_creator_id: creatorId,
    p_price_cents: overrides.priceCents ?? PRICE_CENTS,
    p_post_by: overrides.postBy ?? "2026-12-01",
    p_approval_required: overrides.approvalRequired ?? true,
    p_respond_hours: RESPOND_WINDOW_HOURS,
  });
}

async function walletBalance(walletId: string): Promise<number> {
  const [wallet] = must(
    "wallet balance",
    await admin!.from("wallet").select("balance_cents").eq("id", walletId),
  );
  return Number(wallet.balance_cents);
}

beforeAll(async () => {
  if (!hasCredentials) return;

  brand = await buildBrand("brand", WALLET_CENTS);
  outsider = await buildBrand("outsider", WALLET_CENTS);

  const creatorUser = await createUser("creator");
  creatorToken = creatorUser.token;
  creatorUserId = creatorUser.id;
  creatorClient = creatorUser.client;
  const [creator] = must(
    "creator",
    await admin!
      .from("creator")
      .insert({
        display_name: `${RUN}-creator`,
        linkedin_url: `https://example.test/in/${RUN}-creator`,
        user_id: creatorUser.id,
      })
      .select("id"),
  );
  creatorId = creator.id;
  created.creators.push(creatorId);

  campaigns = {
    alpha: await createCampaign(brand.workspaceId, "alpha"),
    beta: await createCampaign(brand.workspaceId, "beta"),
    gamma: await createCampaign(brand.workspaceId, "gamma"),
    delta: await createCampaign(brand.workspaceId, "delta"),
  };
});

afterAll(async () => {
  if (!hasCredentials || !admin) return;
  // Workspaces first: campaigns, collaborations, wallets and ledger entries all
  // cascade from them.
  for (const id of created.workspaces) await admin.from("workspace").delete().eq("id", id);
  for (const id of created.creators) await admin.from("creator").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
});

describe.skipIf(!hasCredentials)("booking", () => {
  let collaborationId: string;

  it("creates the collaboration, its first event and the commit, together", async () => {
    const before = await walletBalance(brand.walletId);
    const sentAt = Date.now();

    const { data, error } = await book(userClient(brand.token), campaigns.alpha);
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
    collaborationId = data as string;

    const [collaboration] = must(
      "collaboration",
      await admin!
        .from("collaboration")
        .select("state, price_cents, post_by, respond_by, approval_required, workspace_id")
        .eq("id", collaborationId),
    );

    expect(collaboration.state).toBe("invited");
    expect(collaboration.price_cents).toBe(PRICE_CENTS);
    expect(collaboration.post_by).toBe("2026-12-01");
    expect(collaboration.approval_required).toBe(true);
    // The workspace comes from the campaign, never from an argument.
    expect(collaboration.workspace_id).toBe(brand.workspaceId);

    // Measured by the database clock, so this is a window rather than a value.
    const respondBy = new Date(collaboration.respond_by).getTime();
    const expected = sentAt + RESPOND_WINDOW_HOURS * 60 * 60 * 1000;
    expect(Math.abs(respondBy - expected)).toBeLessThan(5 * 60 * 1000);

    const events = must(
      "events",
      await admin!
        .from("collaboration_event")
        .select("from_state, to_state, actor, actor_user_id")
        .eq("collaboration_id", collaborationId),
    );
    expect(events).toEqual([
      { from_state: null, to_state: "invited", actor: "brand", actor_user_id: brand.userId },
    ]);

    const entries = must(
      "ledger",
      await admin!
        .from("ledger_entry")
        .select("kind, amount_cents")
        .eq("collaboration_id", collaborationId),
    );
    // Signed: a commit takes money out, so it is negative.
    expect(entries).toEqual([{ kind: "commit", amount_cents: -PRICE_CENTS }]);

    expect(await walletBalance(brand.walletId)).toBe(before - PRICE_CENTS);
  });

  it("refuses a second live booking of the same creator on the same campaign", async () => {
    const before = await walletBalance(brand.walletId);

    const { error } = await book(userClient(brand.token), campaigns.alpha);
    expect(error?.hint).toBe("already_booked");

    // The refusal has to take the money with it, or a double-click costs twice.
    expect(await walletBalance(brand.walletId)).toBe(before);
    const entries = must(
      "ledger",
      await admin!.from("ledger_entry").select("id").eq("collaboration_id", collaborationId),
    );
    expect(entries).toHaveLength(1);
  });

  it("refuses another workspace's campaign, without confirming it exists", async () => {
    const { error } = await book(userClient(outsider.token), campaigns.alpha);

    // Same answer as a campaign id that is not real: a non-member does not get
    // to learn that the id was.
    expect(error?.hint).toBe("no_campaign");
    expect(error?.message).toMatch(/does not exist/i);
    expect(await walletBalance(outsider.walletId)).toBe(WALLET_CENTS);
  });

  it("refuses a booking the wallet cannot cover", async () => {
    const before = await walletBalance(brand.walletId);

    const { error } = await book(userClient(brand.token), campaigns.beta, {
      priceCents: before + 1,
    });

    expect(error?.hint).toBe("insufficient_funds");
    expect(await walletBalance(brand.walletId)).toBe(before);
  });

  it("refuses a price of zero", async () => {
    const { error } = await book(userClient(brand.token), campaigns.beta, { priceCents: 0 });
    expect(error?.hint).toBe("no_price");
  });

  it("cannot be reached without a session", async () => {
    const anon = createClient(URL_ENV!, ANON_ENV!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await book(anon, campaigns.alpha);
    expect(error).not.toBeNull();
  });
});

describe.skipIf(!hasCredentials)("accepting", () => {
  let collaborationId: string;

  beforeAll(async () => {
    if (!hasCredentials) return;
    const { data, error } = await book(userClient(brand.token), campaigns.gamma);
    if (error) throw new Error(`book for transitions: ${error.message}`);
    collaborationId = data as string;
  });

  /** The steps the machine returns for `accept`, which is what the app sends. */
  const ACCEPT = [
    { from: "invited", to: "accepted", actor: "creator", note: null },
    { from: "accepted", to: "drafting", actor: "system", note: null },
  ];

  it("refuses to move a collaboration that is not yours", async () => {
    const { error } = await userClient(outsider.token).rpc("apply_collaboration_transition", {
      p_collaboration_id: collaborationId,
      p_steps: ACCEPT,
    });

    // RLS matches no row, so the update finds nothing — the same answer as a
    // row that has already moved, and deliberately not a different one.
    expect(error?.hint).toBe("stale_state");

    const [collaboration] = must(
      "collaboration",
      await admin!.from("collaboration").select("state").eq("id", collaborationId),
    );
    expect(collaboration.state).toBe("invited");
  });

  /**
   * Ordered by `at`, deliberately. Both events are written in one transaction,
   * so this is also the test that the log does not shuffle — see
   * 20260828042000_event_order.sql.
   */
  it("applies both steps in one go, and logs each with its own actor", async () => {
    const { data, error } = await userClient(creatorToken).rpc(
      "apply_collaboration_transition",
      { p_collaboration_id: collaborationId, p_steps: ACCEPT },
    );

    expect(error).toBeNull();
    expect(data).toBe("drafting");

    const events = must(
      "events",
      await admin!
        .from("collaboration_event")
        .select("from_state, to_state, actor, actor_user_id")
        .eq("collaboration_id", collaborationId)
        .order("at", { ascending: true }),
    );

    expect(events).toEqual([
      { from_state: null, to_state: "invited", actor: "brand", actor_user_id: brand.userId },
      { from_state: "invited", to_state: "accepted", actor: "creator", actor_user_id: creatorUserId },
      { from_state: "accepted", to_state: "drafting", actor: "system", actor_user_id: null },
    ]);
  });

  it("refuses the same accept twice", async () => {
    const { error } = await userClient(creatorToken).rpc("apply_collaboration_transition", {
      p_collaboration_id: collaborationId,
      p_steps: ACCEPT,
    });

    expect(error?.hint).toBe("stale_state");

    const events = must(
      "events",
      await admin!
        .from("collaboration_event")
        .select("id")
        .eq("collaboration_id", collaborationId),
    );
    // The refused attempt left no half-written log behind it.
    expect(events).toHaveLength(3);
  });
});

/**
 * The path a request actually takes.
 *
 * The database functions are covered above; this is everything between them and
 * a page — the PostgREST select strings, the mapping into the app's own types,
 * and the actor derivation that decides which side of a collaboration the
 * session is on. None of it is reachable from a unit test, and all of it fails
 * at runtime rather than at build time when a relation name is wrong.
 */
describe.skipIf(!hasCredentials)("through the app's own queries", () => {
  it("reads the wallet and the booking target as the brand", async () => {
    session.current = brand.client;

    expect(await loadWalletBalance()).toBe(await walletBalance(brand.walletId));

    const target = await loadBookingTarget(campaigns.delta, creatorId);
    expect(target?.creator.displayName).toBe(`${RUN}-creator`);
    // No creator_rate row, so there is nothing to prefill — null, not zero.
    expect(target?.creator.priceCents).toBeNull();
    expect(target?.existing).toBeNull();
  });

  it("books, then lists what the campaign has booked", async () => {
    session.current = brand.client;

    const result = await bookCreator(campaigns.delta, creatorId, {
      priceCents: PRICE_CENTS,
      postBy: "2026-12-01",
      approvalRequired: false,
    });
    expect(result.kind).toBe("ok");

    const booked = await loadCampaignCollaborations(campaigns.delta);
    expect(booked).toHaveLength(1);
    expect(booked[0].creator.displayName).toBe(`${RUN}-creator`);
    expect(booked[0].state).toBe("invited");
    expect(booked[0].approvalRequired).toBe(false);
    expect(booked[0].priceCents).toBe(PRICE_CENTS);

    // The refusal arrives as a refusal, not as a thrown fault.
    const again = await bookCreator(campaigns.delta, creatorId, {
      priceCents: PRICE_CENTS,
      postBy: "2026-12-01",
      approvalRequired: false,
    });
    expect(again).toEqual({ kind: "refused", reason: expect.stringMatching(/already booked/i) });

    const target = await loadBookingTarget(campaigns.delta, creatorId);
    expect(target?.existing?.state).toBe("invited");
  });

  it("shows the creator their invitation and the brief behind it", async () => {
    session.current = creatorClient;

    const inbox = await loadCreatorCollaborations();
    const invitation = inbox.find((row) => row.state === "invited");
    expect(invitation).toBeDefined();

    const detail = await loadCreatorCollaboration(invitation!.id);
    // The brief crosses to a booked creator; the campaign it belongs to does not.
    expect(detail?.brief).toEqual({
      mode: "creative_freedom",
      body: "Your take.",
      requirements: {},
    });
  });

  it("refuses the brand accepting on the creator's behalf", async () => {
    const [invitation] = must(
      "invitation",
      await admin!
        .from("collaboration")
        .select("id")
        .eq("campaign_id", campaigns.delta)
        .eq("state", "invited"),
    );

    session.current = brand.client;
    const result = await applyTransition(invitation.id, { kind: "accept" });

    // The actor is derived from the session, so a brand asking to accept is
    // refused by the machine rather than by a missing button.
    expect(result).toEqual({ kind: "refused", reason: expect.stringMatching(/only the creator/i) });

    session.current = creatorClient;
    expect(await applyTransition(invitation.id, { kind: "accept" })).toEqual({
      kind: "ok",
      state: "drafting",
    });
  });
});
