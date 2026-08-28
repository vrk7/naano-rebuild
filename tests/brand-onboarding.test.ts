import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildVocabulary } from "@/lib/brand/intelligence";
import { loadIcpWorkbench, saveIcp } from "@/lib/brand/queries";

/**
 * `create_brand_workspace` and `upsert_icp`, against the real database.
 *
 * Both exist for reasons only Postgres can honour. Workspace creation is
 * `security definer` because `workspace` and `workspace_member` have no insert
 * policy at all — every other policy in the schema keys off that membership, so
 * a session that could write it could join any workspace. `upsert_icp` is the
 * transaction: an ICP's row and its whole target set change together, or the
 * score reads half an ICP.
 *
 * The industry mapping is the other thing worth pinning down here.
 * `icp_target.value` holds a topic id for that one dimension and a slug or ISO
 * code for the rest (PRODUCT.md, "One taxonomy"); the form speaks slugs at both
 * ends, so the conversion happens in SQL going in and in `loadIcpWorkbench`
 * coming back, and a mistake in either direction is a target that matches
 * nothing.
 */

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasCredentials = Boolean(URL_ENV && ANON_ENV && SERVICE_ENV);

const RUN = `brand-${Date.now()}`;
const PASSWORD = "test-password-not-a-secret";

const session = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!session.current) throw new Error("No session set for this test.");
    return session.current;
  },
}));

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
const created = { users: [] as string[], workspaces: [] as string[] };

type Account = { id: string; client: SupabaseClient };

let owner: Account;
let outsider: Account;
let topics: Array<{ id: string; slug: string; label: string; kind: "industry" | "function" }>;

async function createAccount(tag: string): Promise<Account> {
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

/** The shape `create_brand_workspace` takes, which is what generation produces. */
function icpPayload(rank: number, label: string, industrySlug: string, geo: string[]) {
  return {
    rank,
    label,
    description: `${label} description`,
    targets: {
      job_function: ["sales"],
      seniority: ["director"],
      industry: [industrySlug],
      geo,
    },
  };
}

beforeAll(async () => {
  if (!hasCredentials) return;

  topics = must(
    "topics",
    await admin!.from("topic").select("id, slug, label, kind"),
  ) as typeof topics;

  owner = await createAccount("owner");
  outsider = await createAccount("outsider");
});

afterAll(async () => {
  if (!hasCredentials || !admin) return;
  for (const id of created.workspaces) await admin.from("workspace").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
});

describe.skipIf(!hasCredentials)("creating the workspace a brand lands in", () => {
  let workspaceId: string;

  it("writes the workspace, its owner, an empty wallet, the profile and the ICPs", async () => {
    const { data, error } = await owner.client.rpc("create_brand_workspace", {
      p_name: `${RUN} Industrial`,
      p_website: "https://atira.example",
      p_profile: {
        companyName: `${RUN} Industrial`,
        tagline: "RFQ turnaround",
        valueProp: "We cut quote turnaround from days to hours.",
        industry: "industrial-equipment",
        sizeBand: "51-200",
      },
      p_icps: [
        icpPayload(1, "Sales engineering leaders", "manufacturing", ["DE", "NL"]),
        icpPayload(2, "Operations directors", "logistics", ["DE"]),
      ],
    });

    expect(error).toBeNull();
    expect(typeof data).toBe("string");
    workspaceId = data as string;
    created.workspaces.push(workspaceId);

    const [member] = must(
      "member",
      await admin!
        .from("workspace_member")
        .select("user_id, role")
        .eq("workspace_id", workspaceId),
    );
    expect(member).toEqual({ user_id: owner.id, role: "owner" });

    const [wallet] = must(
      "wallet",
      await admin!.from("wallet").select("balance_cents").eq("workspace_id", workspaceId),
    );
    // Empty on purpose: nothing tops a wallet up, and a starting balance would
    // be money we invented.
    expect(Number(wallet.balance_cents)).toBe(0);

    const [profile] = must(
      "brand_profile",
      await admin!
        .from("brand_profile")
        .select("company_name, industry_id, size_band, source")
        .eq("workspace_id", workspaceId),
    );
    const industrialEquipment = topics.find((t) => t.slug === "industrial-equipment")!;
    // The slug the model spoke, resolved to the id the column holds.
    expect(profile.industry_id).toBe(industrialEquipment.id);
    expect(profile.source).toBe("auto");

    const icps = must(
      "icps",
      await admin!
        .from("icp")
        .select("id, rank, label, is_active, icp_target ( dimension, value )")
        .eq("workspace_id", workspaceId)
        .order("rank"),
    ) as Array<{
      id: string;
      rank: number;
      label: string;
      is_active: boolean;
      icp_target: Array<{ dimension: string; value: string }>;
    }>;

    expect(icps.map((icp) => icp.rank)).toEqual([1, 2]);

    const manufacturing = topics.find((t) => t.slug === "manufacturing")!;
    const first = icps[0].icp_target;
    // Industry is stored as a topic id; every other dimension keeps its slug or
    // ISO code, because that is what `audience_facet` is joined on.
    expect(first.find((t) => t.dimension === "industry")?.value).toBe(manufacturing.id);
    expect(first.filter((t) => t.dimension === "geo").map((t) => t.value).sort()).toEqual([
      "DE",
      "NL",
    ]);
    expect(first.find((t) => t.dimension === "job_function")?.value).toBe("sales");
  });

  it("refuses a second workspace for the same account", async () => {
    const { error } = await owner.client.rpc("create_brand_workspace", {
      p_name: `${RUN} again`,
      p_website: "https://atira.example",
      p_profile: null,
      p_icps: [],
    });

    // SCOPE.md cuts multi-workspace switching, and every screen assumes one.
    expect(error?.hint).toBe("already_in_workspace");
  });

  it("refuses an industry that is not in the taxonomy", async () => {
    const { error } = await outsider.client.rpc("create_brand_workspace", {
      p_name: `${RUN} outsider`,
      p_website: "https://example.test",
      p_profile: {
        companyName: "Outsider",
        tagline: "",
        valueProp: "Something.",
        industry: "heavy-industry",
        sizeBand: "11-50",
      },
      p_icps: [],
    });

    expect(error?.hint).toBe("unknown_industry");

    // The whole call is one transaction, so the workspace it started to create
    // is not left behind.
    const orphans = must(
      "orphan workspaces",
      await admin!.from("workspace").select("id").eq("name", `${RUN} outsider`),
    );
    expect(orphans).toHaveLength(0);
  });
});

describe.skipIf(!hasCredentials)("editing an ICP", () => {
  it("replaces the target set rather than merging it", async () => {
    session.current = owner.client;

    const before = await loadIcpWorkbench();
    const first = before!.icps.find((icp) => icp.rank === 1)!;
    // Slugs come back out, not the topic id the column holds.
    expect(first.targets.industry).toEqual(["manufacturing"]);

    const saved = await saveIcp({
      id: first.id,
      rank: 1,
      label: "Sales engineering leaders, EU",
      description: "Edited.",
      isActive: true,
      targets: { job_function: ["engineering"], seniority: [], industry: ["saas"], geo: ["FR"] },
    });
    expect(saved.kind).toBe("ok");

    const after = await loadIcpWorkbench();
    const edited = after!.icps.find((icp) => icp.rank === 1)!;

    expect(edited.label).toBe("Sales engineering leaders, EU");
    expect(edited.targets).toEqual({
      job_function: ["engineering"],
      // Cleared, not kept: an empty dimension means "no longer targeted".
      seniority: [],
      industry: ["saas"],
      geo: ["FR"],
    });
  });

  it("creates the rank that was never generated", async () => {
    session.current = owner.client;

    const saved = await saveIcp({
      id: null,
      rank: 3,
      label: "Automotive engineering managers",
      description: "",
      isActive: false,
      targets: { job_function: [], seniority: ["manager"], industry: [], geo: ["DE"] },
    });
    expect(saved.kind).toBe("ok");

    const workbench = await loadIcpWorkbench();
    const third = workbench!.icps.find((icp) => icp.rank === 3)!;
    expect(third.isActive).toBe(false);
    expect(third.targets.seniority).toEqual(["manager"]);
  });

  it("refuses a rank another ICP already holds", async () => {
    session.current = owner.client;

    const saved = await saveIcp({
      id: null,
      rank: 1,
      label: "A second ICP 1",
      description: "",
      isActive: true,
      targets: { job_function: ["sales"], seniority: [], industry: [], geo: [] },
    });

    expect(saved).toEqual({ kind: "refused", reason: expect.stringMatching(/rank/i) });
  });

  /** RLS scopes `icp` to the workspace; the function does not repeat the rule. */
  it("refuses an account editing another workspace's ICP", async () => {
    session.current = owner.client;
    const workbench = await loadIcpWorkbench();
    const target = workbench!.icps[0];

    session.current = outsider.client;
    const saved = await saveIcp({
      id: target.id,
      rank: 1,
      label: "Smuggled",
      description: "",
      isActive: true,
      targets: { job_function: [], seniority: [], industry: [], geo: ["US"] },
    });

    expect(saved).toEqual({ kind: "refused", reason: expect.stringMatching(/not one you can edit/i) });

    session.current = owner.client;
    const after = await loadIcpWorkbench();
    expect(after!.icps.find((icp) => icp.id === target.id)!.label).not.toBe("Smuggled");
  });

  it("sees no workspace at all from an account without one", async () => {
    session.current = outsider.client;
    expect(await loadIcpWorkbench()).toBeNull();
  });
});

describe.skipIf(!hasCredentials)("the vocabulary the editor offers", () => {
  it("is the topic table, split by kind", async () => {
    session.current = owner.client;
    const workbench = await loadIcpWorkbench();
    const vocabulary = buildVocabulary(workbench!.topics);

    expect(vocabulary.industries.has("manufacturing")).toBe(true);
    expect(vocabulary.functions.has("sales")).toBe(true);
    // The two vocabularies never overlap, which is what stops an industry being
    // offered as a job function.
    expect(vocabulary.industries.has("sales")).toBe(false);
  });
});
