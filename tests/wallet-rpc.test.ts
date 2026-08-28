import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MEASUREMENT_WINDOW_DAYS } from "@/lib/collaboration/machine";

/**
 * The two money functions, against the real database.
 *
 * Budget math and access control, which CLAUDE.md requires tests for, and they
 * cannot be tested anywhere else: both functions are `security definer`, and
 * what they guard against is precisely a caller reaching them with the wrong
 * session. A mock would only test the mock.
 *
 * The invariant the arithmetic ones exist for: the ledger and the balance are
 * written in the same transaction, so their sum must always agree. A drift
 * there is money that cannot be reconciled, which is the failure the whole
 * ledger exists to make impossible.
 *
 * Every row carries a run-scoped prefix and is deleted afterwards.
 */

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasCredentials = Boolean(URL_ENV && ANON_ENV && SERVICE_ENV);
const describeDb = hasCredentials ? describe : describe.skip;

const RUN = `wallet-${Date.now()}`;
const PASSWORD = "test-password-not-a-secret";
const START_BALANCE = 100_000;
const PRICE = 40_000;

function adminClient(): SupabaseClient {
  return createClient(URL_ENV!, SERVICE_ENV!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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
const created = {
  users: [] as string[],
  workspaces: [] as string[],
  creators: [] as string[],
};

type Side = {
  token: string;
  workspaceId: string;
  walletId: string;
  /** Published inside its measurement window, so it cannot close yet. */
  openCollaborationId: string;
  /** Published long enough ago that the window has passed. */
  dueCollaborationId: string;
};

let sideA: Side;
let sideB: Side;

async function createUser(email: string): Promise<{ id: string; token: string }> {
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
  return { id: data.user.id, token: signIn.data.session!.access_token };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** A published collaboration whose post landed `publishedDaysAgo` ago. */
async function publishedCollaboration(
  tag: string,
  workspaceId: string,
  campaignId: string,
  creatorId: string,
  publishedDaysAgo: number,
): Promise<string> {
  const [collaboration] = must(
    "collaboration",
    await admin!
      .from("collaboration")
      .insert({
        campaign_id: campaignId,
        creator_id: creatorId,
        workspace_id: workspaceId,
        state: "published",
        price_cents: PRICE,
      })
      .select("id"),
  );

  const [creatorPost] = must(
    "creator_post",
    await admin!
      .from("creator_post")
      .insert({
        creator_id: creatorId,
        external_url: `https://example.test/${RUN}-${tag}`,
        collaboration_id: collaboration.id,
      })
      .select("id"),
  );

  must(
    "post",
    await admin!
      .from("post")
      .insert({
        collaboration_id: collaboration.id,
        creator_post_id: creatorPost.id,
        published_at: daysAgo(publishedDaysAgo),
      })
      .select("id"),
  );

  return collaboration.id;
}

async function buildSide(tag: string, creatorId: string): Promise<Side> {
  const user = await createUser(`${RUN}-${tag}@example.test`);

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
      .insert({ workspace_id: workspace.id, balance_cents: START_BALANCE })
      .select("id"),
  );

  const [campaign] = must(
    "campaign",
    await admin!
      .from("campaign")
      .insert({ workspace_id: workspace.id, name: `${RUN}-${tag}-campaign` })
      .select("id"),
  );

  const open = await publishedCollaboration(
    `${tag}-open`,
    workspace.id,
    campaign.id,
    creatorId,
    1,
  );
  const due = await publishedCollaboration(
    `${tag}-due`,
    workspace.id,
    campaign.id,
    creatorId,
    MEASUREMENT_WINDOW_DAYS + 1,
  );

  // The commits those two bookings would have written — entry and balance
  // together, because a fixture whose ledger already disagrees with its balance
  // cannot test that the functions keep them in step.
  for (const collaborationId of [open, due]) {
    must(
      "commit entry",
      await admin!
        .from("ledger_entry")
        .insert({
          wallet_id: wallet.id,
          kind: "commit",
          amount_cents: -PRICE,
          collaboration_id: collaborationId,
        })
        .select("id"),
    );
  }

  must(
    "commit balance",
    await admin!
      .from("wallet")
      .update({ balance_cents: START_BALANCE - PRICE * 2 })
      .eq("id", wallet.id)
      .select("id"),
  );

  return {
    token: user.token,
    workspaceId: workspace.id,
    walletId: wallet.id,
    openCollaborationId: open,
    dueCollaborationId: due,
  };
}

/** The balance, and what the ledger says it should be. */
async function reconcile(walletId: string): Promise<{ balance: number; sum: number }> {
  const wallet = must(
    "wallet read",
    await admin!.from("wallet").select("balance_cents").eq("id", walletId).single(),
  ) as { balance_cents: number };

  const entries = must(
    "ledger read",
    await admin!.from("ledger_entry").select("amount_cents").eq("wallet_id", walletId),
  ) as Array<{ amount_cents: number }>;

  return {
    balance: wallet.balance_cents,
    // The fixture opens the balance at START_BALANCE without a topup row behind
    // it, so that opening figure is added back to compare like with like.
    sum: START_BALANCE + entries.reduce((total, entry) => total + entry.amount_cents, 0),
  };
}

beforeAll(async () => {
  if (!hasCredentials) return;

  const [creator] = must(
    "creator",
    await admin!
      .from("creator")
      .insert({
        display_name: `${RUN}-creator`,
        linkedin_url: `https://example.test/in/${RUN}-creator`,
      })
      .select("id"),
  );
  created.creators.push(creator.id);

  sideA = await buildSide("a", creator.id);
  sideB = await buildSide("b", creator.id);
});

afterAll(async () => {
  if (!hasCredentials || !admin) return;
  for (const id of created.workspaces) await admin.from("workspace").delete().eq("id", id);
  for (const id of created.creators) await admin.from("creator").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
});

describeDb("topup_wallet", () => {
  it("moves the balance and writes the entry that explains it", async () => {
    const client = userClient(sideA.token);
    const before = await reconcile(sideA.walletId);

    const { data, error } = await client.rpc("topup_wallet", { p_amount_cents: 25_000 });
    expect(error).toBeNull();
    expect(Number(data)).toBe(before.balance + 25_000);

    const after = await reconcile(sideA.walletId);
    expect(after.balance).toBe(before.balance + 25_000);
    // The invariant: ledger and balance never disagree.
    expect(after.sum).toBe(after.balance);
  });

  it.each([0, -1, -25_000])("refuses a non-positive amount (%i)", async (amount) => {
    const client = userClient(sideA.token);
    const before = await reconcile(sideA.walletId);

    const { error } = await client.rpc("topup_wallet", { p_amount_cents: amount });
    expect(error?.hint).toBe("invalid_amount");

    expect((await reconcile(sideA.walletId)).balance).toBe(before.balance);
  });

  it("refuses a caller with no workspace", async () => {
    const stranger = await createUser(`${RUN}-stranger@example.test`);
    const { error } = await userClient(stranger.token).rpc("topup_wallet", {
      p_amount_cents: 5_000,
    });
    expect(error?.hint).toBe("no_workspace");
  });

  it("is unreachable without a session", async () => {
    const anon = createClient(URL_ENV!, ANON_ENV!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await anon.rpc("topup_wallet", { p_amount_cents: 5_000 });
    expect(error).not.toBeNull();
  });
});

describeDb("complete_collaboration", () => {
  it("refuses one whose measurement window is still open", async () => {
    const client = userClient(sideA.token);
    const { error } = await client.rpc("complete_collaboration", {
      p_collaboration_id: sideA.openCollaborationId,
      p_window_days: MEASUREMENT_WINDOW_DAYS,
    });
    expect(error?.hint).toBe("window_open");
  });

  it("closes a due one and releases exactly what was committed", async () => {
    const client = userClient(sideA.token);
    const before = await reconcile(sideA.walletId);

    const { data, error } = await client.rpc("complete_collaboration", {
      p_collaboration_id: sideA.dueCollaborationId,
      p_window_days: MEASUREMENT_WINDOW_DAYS,
    });
    expect(error).toBeNull();
    expect(data).toBe("completed");

    const after = await reconcile(sideA.walletId);
    expect(after.balance).toBe(before.balance + PRICE);
    expect(after.sum).toBe(after.balance);

    const release = must(
      "release entry",
      await admin!
        .from("ledger_entry")
        .select("kind, amount_cents")
        .eq("collaboration_id", sideA.dueCollaborationId)
        .eq("kind", "release"),
    ) as Array<{ kind: string; amount_cents: number }>;
    expect(release).toHaveLength(1);
    expect(release[0].amount_cents).toBe(PRICE);
  });

  it("logs the close as a system step", async () => {
    const events = must(
      "events",
      await admin!
        .from("collaboration_event")
        .select("to_state, actor, actor_user_id")
        .eq("collaboration_id", sideA.dueCollaborationId)
        .eq("to_state", "completed"),
    ) as Array<{ actor: string; actor_user_id: string | null }>;

    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe("system");
    // A system step records no user, even though a person's request ran it.
    expect(events[0].actor_user_id).toBeNull();
  });

  it("is idempotent, so a second sweep does not release the money twice", async () => {
    const client = userClient(sideA.token);
    const before = await reconcile(sideA.walletId);

    const { data, error } = await client.rpc("complete_collaboration", {
      p_collaboration_id: sideA.dueCollaborationId,
      p_window_days: MEASUREMENT_WINDOW_DAYS,
    });
    expect(error).toBeNull();
    expect(data).toBe("completed");

    const after = await reconcile(sideA.walletId);
    expect(after.balance).toBe(before.balance);
    expect(after.sum).toBe(after.balance);
  });

  it("hides another workspace's collaboration rather than refusing it differently", async () => {
    const client = userClient(sideA.token);
    const { error } = await client.rpc("complete_collaboration", {
      p_collaboration_id: sideB.dueCollaborationId,
      p_window_days: MEASUREMENT_WINDOW_DAYS,
    });
    // Same answer as a row that does not exist: a caller learns nothing about
    // whether someone else's collaboration is real.
    expect(error?.hint).toBe("not_found");
  });

  it("leaves the other workspace's money untouched", async () => {
    const sideBWallet = await reconcile(sideB.walletId);
    expect(sideBWallet.balance).toBe(START_BALANCE - PRICE * 2);
    expect(sideBWallet.sum).toBe(sideBWallet.balance);
  });
});
