import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Access control, one of the four things CLAUDE.md requires tests for.
 *
 * These run against the real Supabase project, because RLS is enforced by
 * Postgres and a mock would only test the mock. The fixture is two brand
 * workspaces that have never met and one creator booked by exactly one of them,
 * which is the smallest shape that can demonstrate both crossings:
 *
 *   1. Workspace A cannot read workspace B's campaigns, posts or leads.
 *   2. A creator sees only the collaborations they are on.
 *
 * Every row created here carries a run-scoped prefix and is deleted afterwards.
 */

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasCredentials = Boolean(URL_ENV && ANON_ENV && SERVICE_ENV);

const RUN = `rls-${Date.now()}`;
const PASSWORD = "test-password-not-a-secret";

/** Service-role client. Bypasses RLS, so it is only ever used to build fixtures. */
function adminClient(): SupabaseClient {
  return createClient(URL_ENV!, SERVICE_ENV!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** A client that carries one user's session, so RLS applies as it would in the app. */
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

type Side = {
  userId: string;
  token: string;
  workspaceId: string;
  campaignId: string;
  collaborationId: string;
  postId: string;
  personId: string;
  companyId: string;
  icpId: string;
};

const admin = hasCredentials ? adminClient() : null;
const created = { users: [] as string[], workspaces: [] as string[], creators: [] as string[], companies: [] as string[], people: [] as string[] };

let sideA: Side;
let sideB: Side;
let creatorToken: string;
let creatorId: string;

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

/** One complete brand workspace with a published post and a lead on it. */
async function buildSide(tag: string, bookedCreatorId: string): Promise<Side> {
  const user = await createUser(`${RUN}-${tag}@example.test`);

  const [workspace] = must("workspace", await admin!.from("workspace")
    .insert({ name: `${RUN}-${tag}` }).select("id"));
  created.workspaces.push(workspace.id);

  must("member", await admin!.from("workspace_member")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" }).select("id"));

  const [icp] = must("icp", await admin!.from("icp")
    .insert({ workspace_id: workspace.id, rank: 1, label: `${tag} icp` }).select("id"));

  const [campaign] = must("campaign", await admin!.from("campaign")
    .insert({ workspace_id: workspace.id, name: `${RUN}-${tag}-campaign` }).select("id"));

  must("brief", await admin!.from("brief")
    .insert({ campaign_id: campaign.id, mode: "specific", body: `${tag} brief` }).select("id"));

  const [collaboration] = must("collaboration", await admin!.from("collaboration")
    .insert({
      campaign_id: campaign.id,
      creator_id: bookedCreatorId,
      workspace_id: workspace.id,
      price_cents: 50_000,
    }).select("id"));

  const [creatorPost] = must("creator_post", await admin!.from("creator_post")
    .insert({
      creator_id: bookedCreatorId,
      external_url: `https://example.test/${RUN}-${tag}`,
      collaboration_id: collaboration.id,
    }).select("id"));

  const [post] = must("post", await admin!.from("post")
    .insert({ collaboration_id: collaboration.id, creator_post_id: creatorPost.id }).select("id"));

  const [company] = must("company", await admin!.from("company")
    .insert({ name: `${RUN}-${tag}-co`, domain: `${RUN}-${tag}.test` }).select("id"));
  created.companies.push(company.id);

  const [person] = must("person", await admin!.from("person")
    .insert({ full_name: `${RUN}-${tag}-person`, company_id: company.id }).select("id"));
  created.people.push(person.id);

  must("engagement", await admin!.from("engagement")
    .insert({ post_id: post.id, person_id: person.id, kind: "reaction" }).select("id"));

  must("icp_match", await admin!.from("icp_match")
    .insert({ person_id: person.id, icp_id: icp.id, score: 80 }).select("id"));

  return {
    userId: user.id,
    token: user.token,
    workspaceId: workspace.id,
    campaignId: campaign.id,
    collaborationId: collaboration.id,
    postId: post.id,
    personId: person.id,
    companyId: company.id,
    icpId: icp.id,
  };
}

beforeAll(async () => {
  if (!hasCredentials) return;

  // The creator that side A books, with a login attached.
  const creatorUser = await createUser(`${RUN}-creator@example.test`);
  creatorToken = creatorUser.token;
  const [creatorRow] = must("creator", await admin!.from("creator")
    .insert({
      display_name: `${RUN}-creator`,
      linkedin_url: `https://example.test/in/${RUN}-creator`,
      user_id: creatorUser.id,
    }).select("id"));
  creatorId = creatorRow.id;
  created.creators.push(creatorId);

  // A second creator with no login, booked by side B.
  const [otherCreator] = must("other creator", await admin!.from("creator")
    .insert({
      display_name: `${RUN}-other`,
      linkedin_url: `https://example.test/in/${RUN}-other`,
    }).select("id"));
  created.creators.push(otherCreator.id);

  sideA = await buildSide("a", creatorId);
  sideB = await buildSide("b", otherCreator.id);
});

afterAll(async () => {
  if (!hasCredentials || !admin) return;
  // Workspaces first: campaigns, collaborations, posts and engagements cascade
  // from them, and post -> creator_post is on delete restrict.
  for (const id of created.workspaces) await admin.from("workspace").delete().eq("id", id);
  for (const id of created.people) await admin.from("person").delete().eq("id", id);
  for (const id of created.companies) await admin.from("company").delete().eq("id", id);
  for (const id of created.creators) await admin.from("creator").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
});

describe.skipIf(!hasCredentials)("crossing 1: one workspace cannot read another's", () => {
  it("campaigns", async () => {
    const a = userClient(sideA.token);
    const visible = must("campaigns", await a.from("campaign").select("id"));

    expect(visible.map((r) => r.id)).toContain(sideA.campaignId);
    expect(visible.map((r) => r.id)).not.toContain(sideB.campaignId);

    // Naming the other row directly must not reveal it either.
    const direct = must("campaign by id",
      await a.from("campaign").select("id").eq("id", sideB.campaignId));
    expect(direct).toHaveLength(0);
  });

  it("posts", async () => {
    const a = userClient(sideA.token);
    const visible = must("posts", await a.from("post").select("id"));

    expect(visible.map((r) => r.id)).toContain(sideA.postId);
    expect(visible.map((r) => r.id)).not.toContain(sideB.postId);
  });

  it("leads — people, companies, engagements and icp matches", async () => {
    const a = userClient(sideA.token);

    const people = must("person", await a.from("person").select("id"));
    expect(people.map((r) => r.id)).toContain(sideA.personId);
    expect(people.map((r) => r.id)).not.toContain(sideB.personId);

    const companies = must("company", await a.from("company").select("id"));
    expect(companies.map((r) => r.id)).toContain(sideA.companyId);
    expect(companies.map((r) => r.id)).not.toContain(sideB.companyId);

    const engagements = must("engagement",
      await a.from("engagement").select("post_id, person_id"));
    expect(engagements.map((r) => r.person_id)).not.toContain(sideB.personId);

    const matches = must("icp_match", await a.from("icp_match").select("icp_id"));
    expect(matches.map((r) => r.icp_id)).not.toContain(sideB.icpId);
  });

  it("holds in both directions", async () => {
    const b = userClient(sideB.token);
    const campaigns = must("campaigns", await b.from("campaign").select("id"));

    expect(campaigns.map((r) => r.id)).toContain(sideB.campaignId);
    expect(campaigns.map((r) => r.id)).not.toContain(sideA.campaignId);
  });

  it("refuses a cross-workspace write", async () => {
    const a = userClient(sideA.token);
    const { error } = await a
      .from("campaign")
      .insert({ workspace_id: sideB.workspaceId, name: `${RUN}-smuggled` });

    expect(error).not.toBeNull();
  });
});

describe.skipIf(!hasCredentials)("crossing 2: a creator sees only their collaborations", () => {
  it("sees the one they are on and not the other", async () => {
    const c = userClient(creatorToken);
    const visible = must("collaborations", await c.from("collaboration").select("id"));

    expect(visible.map((r) => r.id)).toEqual([sideA.collaborationId]);
    expect(visible.map((r) => r.id)).not.toContain(sideB.collaborationId);
  });

  it("cannot read any campaign", async () => {
    const c = userClient(creatorToken);
    const campaigns = must("campaigns", await c.from("campaign").select("id"));

    expect(campaigns).toHaveLength(0);
  });

  it("reads the brief of the campaign they are booked on, and no other", async () => {
    const c = userClient(creatorToken);
    const briefs = must("briefs", await c.from("brief").select("campaign_id"));

    expect(briefs.map((r) => r.campaign_id)).toEqual([sideA.campaignId]);
  });

  it("cannot read leads at all", async () => {
    const c = userClient(creatorToken);

    expect(must("person", await c.from("person").select("id"))).toHaveLength(0);
    expect(must("company", await c.from("company").select("id"))).toHaveLength(0);
    expect(must("engagement", await c.from("engagement").select("post_id"))).toHaveLength(0);
    expect(must("icp_match", await c.from("icp_match").select("icp_id"))).toHaveLength(0);
  });

  it("cannot create a collaboration to book itself onto a campaign", async () => {
    const c = userClient(creatorToken);
    const { error } = await c.from("collaboration").insert({
      campaign_id: sideB.campaignId,
      creator_id: creatorId,
      workspace_id: sideB.workspaceId,
      price_cents: 1,
    });

    expect(error).not.toBeNull();
  });
});

describe.skipIf(!hasCredentials)("marketplace listings stay readable", () => {
  it("a brand can read creators it has never booked", async () => {
    const a = userClient(sideA.token);
    const creators = must("creator", await a.from("creator").select("id").limit(5));

    expect(creators.length).toBeGreaterThan(0);
  });

  it("an anonymous caller reads nothing", async () => {
    const anon = createClient(URL_ENV!, ANON_ENV!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    expect(must("creator", await anon.from("creator").select("id").limit(5))).toHaveLength(0);
    expect(must("campaign", await anon.from("campaign").select("id"))).toHaveLength(0);
  });
});
