/**
 * Seeds the demo workspace: a brand, its ICPs, two campaigns, and five
 * collaborations already published with engagements and leads on them.
 *
 * Run with:  npm run db:seed:demo   (requires npm run db:seed first)
 *
 * Not idempotent in the way the creator seed is — it removes the demo workspace
 * and its leads and rebuilds them, because a collaboration has no natural key
 * and re-running would otherwise stack a second set of posts onto the same
 * campaigns. Only rows belonging to this workspace are touched.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { generateCreators } from "../src/lib/seed/creators.ts";
import {
  DEMO_BOOKINGS,
  DEMO_CAMPAIGNS,
  DEMO_ICPS,
  DEMO_WORKSPACE,
  type BookingSeed,
} from "../src/lib/seed/demo.ts";
import {
  PersonPool,
  createSeedEngagementSource,
  type AudienceDistribution,
  type GeneratedEngagement,
  type GeneratedPerson,
} from "../src/lib/seed/engagement.ts";
import { createRng, hashSeed, randomInt } from "../src/lib/seed/random.ts";
import { SIZE_BANDS } from "../src/lib/taxonomy/size-bands.ts";
import { scorePerson } from "../src/lib/score/person.ts";
import {
  ICP_MATCH_THRESHOLD,
  type ScoreDimension,
} from "../src/lib/score/weights.ts";

const INSERT_BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Transient-failure retry for the network hop only.
 *
 * This script makes a few hundred round trips to Supabase and a single dropped
 * connection kills the whole run, leaving a half-built workspace. Three
 * attempts with a 500ms linear backoff was enough to ride out the one failure
 * observed while writing it ("TypeError: fetch failed" mid-batch); neither
 * number is measured, and if the network is genuinely down all three fail fast
 * and the error propagates.
 *
 * Only wraps transport errors. A Postgres error — a constraint violation, a
 * bad column — is returned in `error` rather than thrown, is not retried, and
 * still fails the run.
 */
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 500;

async function withRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("fetch failed")) throw error;
      if (attempt < RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * attempt));
      }
    }
  }
  throw new Error(
    `${label} failed after ${RETRY_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

/**
 * Matches scoring zero are not written: a row saying "this person matches
 * nothing" is noise, not data. Everything above zero is stored with its score,
 * and ICP_MATCH_THRESHOLD decides what counts as matched when reading.
 */
const ICP_MATCH_STORE_FLOOR = 1;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Run via npm run db:seed:demo.`);
  return value;
}

function unwrap<T>(label: string, result: { data: T | null; error: unknown }): T {
  if (result.error) {
    const detail =
      result.error instanceof Error ? result.error.message : JSON.stringify(result.error);
    throw new Error(`${label} failed: ${detail}`);
  }
  if (result.data === null) throw new Error(`${label} returned no data`);
  return result.data;
}

async function insertBatched(
  client: SupabaseClient,
  table: string,
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    const { error } = await withRetry(`insert ${table}`, async () =>
      await client.from(table).insert(batch),
    );
    if (error) throw new Error(`insert ${table} failed: ${error.message}`);
  }
}

/** Removes a previous run so this one is a rebuild, not an accumulation. */
async function clearPreviousRun(client: SupabaseClient): Promise<void> {
  const existing = unwrap(
    "find demo workspace",
    await client.from("workspace").select("id").eq("name", DEMO_WORKSPACE.name),
  ) as Array<{ id: string }>;
  if (existing.length === 0) return;

  const ids = existing.map((w) => w.id);

  // person and company are global, so they do not cascade from the workspace.
  // Both are demo-only here and identified by their generated domain prefix.
  const { error: personError } = await client
    .from("person")
    .delete()
    .like("linkedin_url", "https://example.invalid/demo/%");
  if (personError) throw new Error(`clear demo people failed: ${personError.message}`);

  const { error: companyError } = await client
    .from("company")
    .delete()
    .like("domain", "demo-%");
  if (companyError) throw new Error(`clear demo companies failed: ${companyError.message}`);

  // creator_post is owned by a creator, not the workspace, so it survives the
  // cascade; post -> creator_post is on delete restrict, so posts must go first.
  const { error: cpError } = await client
    .from("creator_post")
    .delete()
    .like("external_url", "https://example.invalid/demo/%");
  if (cpError && !cpError.message.includes("violates foreign key")) {
    throw new Error(`clear demo creator posts failed: ${cpError.message}`);
  }

  const { error } = await client.from("workspace").delete().in("id", ids);
  if (error) throw new Error(`clear demo workspace failed: ${error.message}`);

  // Retry now that the cascade has removed the posts referencing them.
  const { error: retry } = await client
    .from("creator_post")
    .delete()
    .like("external_url", "https://example.invalid/demo/%");
  if (retry) throw new Error(`clear demo creator posts failed: ${retry.message}`);
}

async function loadTopicIds(client: SupabaseClient): Promise<Map<string, string>> {
  const data = unwrap("load topics", await client.from("topic").select("id, slug"));
  return new Map((data as Array<{ id: string; slug: string }>).map((t) => [t.slug, t.id]));
}

/** The creator's own audience, read back out of the tables the score reads. */
async function loadAudience(
  client: SupabaseClient,
  creatorId: string,
): Promise<{ snapshotId: string; audience: AudienceDistribution }> {
  const snapshots = unwrap(
    "load snapshot",
    await client
      .from("audience_snapshot")
      .select("id")
      .eq("creator_id", creatorId)
      .order("captured_at", { ascending: false })
      .limit(1),
  ) as Array<{ id: string }>;
  if (snapshots.length === 0) throw new Error(`creator ${creatorId} has no audience snapshot`);

  const facets = unwrap(
    "load facets",
    await client
      .from("audience_facet")
      .select("dimension, value, share")
      .eq("snapshot_id", snapshots[0].id),
  ) as Array<{ dimension: ScoreDimension; value: string; share: string | number }>;

  const audience = {
    job_function: [],
    seniority: [],
    industry: [],
    geo: [],
  } as Record<ScoreDimension, Array<{ value: string; share: number }>>;

  for (const f of facets) {
    audience[f.dimension].push({ value: f.value, share: Number(f.share) });
  }
  return { snapshotId: snapshots[0].id, audience };
}

type WorkspaceContext = {
  workspaceId: string;
  icps: Array<{ id: string; rank: number; targets: Record<ScoreDimension, string[]> }>;
  campaignIds: Map<string, string>;
};

async function seedWorkspace(
  client: SupabaseClient,
  topicIds: Map<string, string>,
): Promise<WorkspaceContext> {
  const [workspace] = unwrap(
    "insert workspace",
    await client
      .from("workspace")
      .insert({ name: DEMO_WORKSPACE.name, website: DEMO_WORKSPACE.website })
      .select("id"),
  ) as Array<{ id: string }>;

  const brand = DEMO_WORKSPACE.brand;
  unwrap(
    "insert brand_profile",
    await client
      .from("brand_profile")
      .insert({
        workspace_id: workspace.id,
        company_name: brand.companyName,
        website: DEMO_WORKSPACE.website,
        tagline: brand.tagline,
        value_prop: brand.valueProp,
        industry_id: topicIds.get(brand.industrySlug)!,
        size_band: brand.sizeBand,
        source: "auto",
        generated_at: new Date().toISOString(),
      })
      .select("id"),
  );

  const [wallet] = unwrap(
    "insert wallet",
    await client
      .from("wallet")
      .insert({
        workspace_id: workspace.id,
        balance_cents: DEMO_WORKSPACE.walletBalanceCents,
      })
      .select("id"),
  ) as Array<{ id: string }>;

  // The entry the balance came from. `book_creator` writes the ledger row and
  // the new balance in one transaction, so the two never disagree in the
  // product; without this the seeded workspace would open with five commits
  // against money nothing ever put in.
  unwrap(
    "insert topup",
    await client
      .from("ledger_entry")
      .insert({
        wallet_id: wallet.id,
        kind: "topup",
        amount_cents: DEMO_WORKSPACE.walletBalanceCents,
      })
      .select("id"),
  );

  const icps: WorkspaceContext["icps"] = [];
  for (const seed of DEMO_ICPS) {
    const [row] = unwrap(
      "insert icp",
      await client
        .from("icp")
        .insert({
          workspace_id: workspace.id,
          rank: seed.rank,
          label: seed.label,
          description: seed.description,
        })
        .select("id"),
    ) as Array<{ id: string }>;

    // Industry targets carry topic ids, matching audience_facet so the two
    // join on (dimension, value).
    const targets = {
      job_function: [...seed.targets.job_function],
      seniority: [...seed.targets.seniority],
      industry: seed.targets.industry.map((slug) => topicIds.get(slug)!),
      geo: [...seed.targets.geo],
    };

    const rows = (Object.keys(targets) as ScoreDimension[]).flatMap((dimension) =>
      targets[dimension].map((value) => ({ icp_id: row.id, dimension, value })),
    );
    await insertBatched(client, "icp_target", rows);

    icps.push({ id: row.id, rank: seed.rank, targets });
  }

  const campaignIds = new Map<string, string>();
  for (const campaign of DEMO_CAMPAIGNS) {
    const [row] = unwrap(
      "insert campaign",
      await client
        .from("campaign")
        .insert({
          workspace_id: workspace.id,
          name: campaign.name,
          objective: campaign.objective,
          status: "live",
          geos: campaign.geos,
        })
        .select("id"),
    ) as Array<{ id: string }>;

    unwrap(
      "insert brief",
      await client
        .from("brief")
        .insert({
          campaign_id: row.id,
          mode: campaign.brief.mode,
          body: campaign.brief.body,
          requirements: campaign.brief.requirements,
        })
        .select("id"),
    );
    campaignIds.set(campaign.key, row.id);
  }

  return { workspaceId: workspace.id, icps, campaignIds };
}

/**
 * The event log for a collaboration that ran cleanly to published, per the
 * state machine in PRODUCT.md. Timestamps walk backwards from publish.
 */
function eventChain(collaborationId: string, publishedAt: Date) {
  const at = (daysBefore: number) =>
    new Date(publishedAt.getTime() - daysBefore * DAY_MS).toISOString();

  return [
    { from_state: null, to_state: "invited", actor: "brand", note: "Offer sent", at: at(11) },
    { from_state: "invited", to_state: "accepted", actor: "creator", note: null, at: at(10) },
    { from_state: "accepted", to_state: "drafting", actor: "system", note: null, at: at(10) },
    { from_state: "drafting", to_state: "in_review", actor: "creator", note: "Draft submitted", at: at(5) },
    { from_state: "in_review", to_state: "approved", actor: "brand", note: "Approved", at: at(3) },
    { from_state: "approved", to_state: "published", actor: "creator", note: null, at: at(0) },
  ].map((e) => ({ ...e, collaboration_id: collaborationId }));
}

type BookingResult = {
  booking: BookingSeed;
  creatorName: string;
  followers: number;
  priceCents: number;
  engagements: number;
  people: number;
  matched: number;
};

async function seedBooking(
  client: SupabaseClient,
  context: WorkspaceContext,
  booking: BookingSeed,
  creatorIdByUrl: Map<string, string>,
  pool: PersonPool,
): Promise<BookingResult> {
  const generated = generateCreators().filter((c) => c.archetype === booking.archetype);
  const chosen = generated[booking.nth];
  if (!chosen) throw new Error(`no creator ${booking.nth} in archetype ${booking.archetype}`);

  const creatorId = creatorIdByUrl.get(chosen.linkedinUrl);
  if (!creatorId) throw new Error(`creator ${chosen.displayName} is not seeded`);

  const publishedAt = new Date(Date.now() - booking.publishedDaysAgo * DAY_MS);
  const { audience } = await loadAudience(client, creatorId);

  const [collaboration] = unwrap(
    "insert collaboration",
    await client
      .from("collaboration")
      .insert({
        campaign_id: context.campaignIds.get(booking.campaignKey)!,
        creator_id: creatorId,
        workspace_id: context.workspaceId,
        state: "published",
        price_cents: chosen.priceCents,
        post_by: publishedAt.toISOString().slice(0, 10),
        respond_by: new Date(publishedAt.getTime() - 10 * DAY_MS).toISOString(),
        approval_required: true,
        created_at: new Date(publishedAt.getTime() - 11 * DAY_MS).toISOString(),
      })
      .select("id"),
  ) as Array<{ id: string }>;

  await insertBatched(client, "collaboration_event", eventChain(collaboration.id, publishedAt));

  unwrap(
    "insert draft",
    await client
      .from("draft")
      .insert({
        collaboration_id: collaboration.id,
        version: 1,
        body: booking.postBody,
        submitted_at: new Date(publishedAt.getTime() - 5 * DAY_MS).toISOString(),
      })
      .select("id"),
  );

  const engagements = createSeedEngagementSource(pool).engagementsFor({
    seed: `${booking.archetype}:${booking.nth}:${booking.campaignKey}`,
    followers: chosen.followers,
    publishedAt,
    audience,
  });

  const rng = createRng(hashSeed(`post:${chosen.linkedinUrl}`));
  const [creatorPost] = unwrap(
    "insert creator_post",
    await client
      .from("creator_post")
      .insert({
        creator_id: creatorId,
        external_url: `https://example.invalid/demo/${collaboration.id}`,
        published_at: publishedAt.toISOString(),
        body: booking.postBody,
        // Impressions run well ahead of engagement, as they do on LinkedIn.
        impressions: engagements.length * randomInt(rng, 18, 46),
        reactions: engagements.filter((e) => e.kind === "reaction").length,
        comments: engagements.filter((e) => e.kind === "comment").length,
        reposts: engagements.filter((e) => e.kind === "repost").length,
        is_sponsored: true,
        collaboration_id: collaboration.id,
      })
      .select("id"),
  ) as Array<{ id: string }>;

  const [post] = unwrap(
    "insert post",
    await client
      .from("post")
      .insert({
        collaboration_id: collaboration.id,
        creator_post_id: creatorPost.id,
        tracked_url: `https://example.invalid/demo/${collaboration.id}?ref=atira`,
        published_at: publishedAt.toISOString(),
      })
      .select("id"),
  ) as Array<{ id: string }>;

  unwrap(
    "insert ledger_entry",
    await client
      .from("ledger_entry")
      .insert({
        wallet_id: (
          unwrap(
            "load wallet",
            await client.from("wallet").select("id").eq("workspace_id", context.workspaceId),
          ) as Array<{ id: string }>
        )[0].id,
        kind: "commit",
        amount_cents: -chosen.priceCents,
        collaboration_id: collaboration.id,
        at: new Date(publishedAt.getTime() - 11 * DAY_MS).toISOString(),
      })
      .select("id"),
  );

  const matched = await writeLeads(client, context, post.id, engagements);

  return {
    booking,
    creatorName: chosen.displayName,
    followers: chosen.followers,
    priceCents: chosen.priceCents,
    engagements: engagements.length,
    people: new Set(engagements.map((e) => e.person.key)).size,
    matched,
  };
}

/** Persists companies, people, engagements and ICP matches for one post. */
async function writeLeads(
  client: SupabaseClient,
  context: WorkspaceContext,
  postId: string,
  engagements: ReadonlyArray<GeneratedEngagement>,
): Promise<number> {
  const people = new Map<string, GeneratedPerson>();
  for (const e of engagements) people.set(e.person.key, e.person);

  const companyIds = await upsertCompanies(client, [...people.values()]);
  const personIds = await upsertPeople(client, [...people.values()], companyIds);

  await insertBatched(
    client,
    "engagement",
    engagements.map((e) => ({
      post_id: postId,
      person_id: personIds.get(e.person.key)!,
      kind: e.kind,
      occurred_at: e.occurredAt.toISOString(),
    })),
  );

  const matches: Array<Record<string, unknown>> = [];
  let matchedPeople = 0;

  for (const person of people.values()) {
    const point = {
      job_function: person.jobFunction,
      seniority: person.seniority,
      industry: person.industryTopicId,
      geo: person.geo,
    };
    let best = 0;
    for (const icp of context.icps) {
      const { value, matched } = scorePerson(point, icp.targets);
      best = Math.max(best, value);
      if (value < ICP_MATCH_STORE_FLOOR) continue;
      matches.push({
        person_id: personIds.get(person.key)!,
        icp_id: icp.id,
        score: value,
        reasons: { matched_dimensions: matched },
      });
    }
    if (best >= ICP_MATCH_THRESHOLD) matchedPeople += 1;
  }

  // A repeat engager already carries their matches from an earlier post.
  const { error } = await client
    .from("icp_match")
    .upsert(matches, { onConflict: "person_id,icp_id", ignoreDuplicates: true });
  if (error) throw new Error(`upsert icp_match failed: ${error.message}`);

  return matchedPeople;
}

const companyCache = new Map<string, string>();

async function upsertCompanies(
  client: SupabaseClient,
  people: ReadonlyArray<GeneratedPerson>,
): Promise<Map<string, string>> {
  const keys = [...new Set(people.map((p) => p.companyKey))].filter(
    (k) => !companyCache.has(k),
  );

  if (keys.length > 0) {
    const rows = keys.map((key) => {
      const [industryTopicId, geo, slot] = key.split(":");
      const rng = createRng(hashSeed(key));
      return {
        name: `${COMPANY_PREFIXES[Math.floor(rng() * COMPANY_PREFIXES.length)]} ${
          COMPANY_SUFFIXES[Math.floor(rng() * COMPANY_SUFFIXES.length)]
        }`,
        domain: `demo-${key.replace(/:/g, "-")}.example`,
        industry_id: industryTopicId,
        size_band: SIZE_BANDS[Math.floor(rng() * SIZE_BANDS.length)],
        country: geo,
      };
    });
    await insertBatched(client, "company", rows);

    const inserted = unwrap(
      "load companies",
      await client
        .from("company")
        .select("id, domain")
        .in("domain", rows.map((r) => r.domain)),
    ) as Array<{ id: string; domain: string }>;

    const byDomain = new Map(inserted.map((c) => [c.domain, c.id]));
    for (const key of keys) {
      companyCache.set(key, byDomain.get(`demo-${key.replace(/:/g, "-")}.example`)!);
    }
  }

  return companyCache;
}

const personCache = new Map<string, string>();

async function upsertPeople(
  client: SupabaseClient,
  people: ReadonlyArray<GeneratedPerson>,
  companyIds: Map<string, string>,
): Promise<Map<string, string>> {
  const fresh = people.filter((p) => !personCache.has(p.key));

  if (fresh.length > 0) {
    const rows = fresh.map((p) => ({
      full_name: p.fullName,
      headline: p.headline,
      role_title: p.roleTitle,
      seniority: p.seniority,
      linkedin_url: `https://example.invalid/demo/person/${p.key}`,
      company_id: companyIds.get(p.companyKey)!,
    }));
    await insertBatched(client, "person", rows);

    const inserted = unwrap(
      "load people",
      await client
        .from("person")
        .select("id, linkedin_url")
        .in("linkedin_url", rows.map((r) => r.linkedin_url)),
    ) as Array<{ id: string; linkedin_url: string }>;

    const byUrl = new Map(inserted.map((p) => [p.linkedin_url, p.id]));
    for (const p of fresh) {
      personCache.set(p.key, byUrl.get(`https://example.invalid/demo/person/${p.key}`)!);
    }
  }

  return personCache;
}

const COMPANY_PREFIXES = [
  "Nordwerk", "Brakel", "Castellan", "Vantage", "Kordis", "Meridian", "Halberd",
  "Steinbach", "Auriga", "Voltek", "Cerdan", "Lindmark", "Trevisan", "Okonjo",
];
const COMPANY_SUFFIXES = [
  "Industries", "Systems", "Manufacturing", "Group", "Werke", "Technologies",
  "Engineering", "Holdings",
];


/**
 * Optionally attaches logins to the demo data.
 *
 * Without this the demo workspace has no member, so every signed-in brand sees
 * an empty campaign list and the seeded posts are unreachable through the UI —
 * RLS is doing its job, there is simply nobody who belongs to the workspace.
 *
 * Gated on env vars rather than hardcoding a password: a known credential
 * committed to a repo is a credential in every clone of it. Skipped silently,
 * with a note, when they are absent.
 */
async function seedDemoLogins(
  client: SupabaseClient,
  workspaceId: string,
  creatorId: string,
): Promise<string[]> {
  const email = process.env.SEED_DEMO_EMAIL;
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!email || !password) return [];

  const notes: string[] = [];
  const [local, domain] = email.split("@");
  if (!domain) throw new Error("SEED_DEMO_EMAIL is not an email address");

  const accounts = [
    { role: "brand" as const, address: email },
    { role: "creator" as const, address: `${local}+creator@${domain}` },
  ];

  for (const account of accounts) {
    // Remove any user from a previous run so the password is whatever the env
    // currently says, rather than silently keeping an older one.
    const { data: existing } = await client.auth.admin.listUsers();
    const previous = existing?.users.find((u) => u.email === account.address);
    if (previous) await client.auth.admin.deleteUser(previous.id);

    const { data, error } = await client.auth.admin.createUser({
      email: account.address,
      password,
      email_confirm: true,
      user_metadata: { role: account.role, display_name: `Demo ${account.role}` },
    });
    if (error) throw new Error(`create demo ${account.role} failed: ${error.message}`);

    if (account.role === "brand") {
      const { error: memberError } = await client
        .from("workspace_member")
        .insert({ workspace_id: workspaceId, user_id: data.user.id, role: "owner" });
      if (memberError) {
        throw new Error(`add demo owner failed: ${memberError.message}`);
      }
    } else {
      // Claims one of the booked creators, so the creator side has real
      // collaborations rather than an empty shell.
      const { error: claimError } = await client
        .from("creator")
        .update({ user_id: data.user.id })
        .eq("id", creatorId);
      if (claimError) throw new Error(`claim demo creator failed: ${claimError.message}`);
    }

    notes.push(`${account.role.padEnd(8)} ${account.address}`);
  }

  return notes;
}

async function main(): Promise<void> {
  const client = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  await clearPreviousRun(client);

  const topicIds = await loadTopicIds(client);
  if (topicIds.size === 0) {
    throw new Error("No topics found. Run npm run db:seed first.");
  }

  const creators = unwrap(
    "load creators",
    await client.from("creator").select("id, linkedin_url"),
  ) as Array<{ id: string; linkedin_url: string }>;
  const creatorIdByUrl = new Map(creators.map((c) => [c.linkedin_url, c.id]));

  const context = await seedWorkspace(client, topicIds);
  const pool = new PersonPool();

  const results: BookingResult[] = [];
  for (const booking of DEMO_BOOKINGS) {
    results.push(await seedBooking(client, context, booking, creatorIdByUrl, pool));
  }

  console.log(`\nworkspace   ${DEMO_WORKSPACE.name}`);
  console.log(`icps        ${context.icps.length}`);
  console.log(`campaigns   ${context.campaignIds.size}`);
  console.log(`\npublished collaborations:`);
  console.log(
    `  ${"creator".padEnd(22)}${"followers".padStart(10)}${"engaged".padStart(9)}` +
      `${"in ICP".padStart(8)}${"cost/ICP".padStart(11)}`,
  );
  for (const r of results) {
    const costPerMatch =
      r.matched > 0 ? `$${Math.round(r.priceCents / 100 / r.matched)}` : "—";
    console.log(
      `  ${r.creatorName.padEnd(22)}${r.followers.toLocaleString().padStart(10)}` +
        `${String(r.people).padStart(9)}${String(r.matched).padStart(8)}${costPerMatch.padStart(11)}`,
    );
  }
  console.log(`\npeople      ${personCache.size}`);
  console.log(`companies   ${companyCache.size}`);

  // Settling up once, rather than after each booking: the seed is the only
  // writer here, so the arithmetic is the same and the round trips are not.
  const committedCents = results.reduce((total, result) => total + result.priceCents, 0);
  unwrap(
    "settle wallet",
    await client
      .from("wallet")
      .update({ balance_cents: DEMO_WORKSPACE.walletBalanceCents - committedCents })
      .eq("workspace_id", context.workspaceId)
      .select("id"),
  );
  console.log(
    `wallet      $${((DEMO_WORKSPACE.walletBalanceCents - committedCents) / 100).toLocaleString()} left of ` +
      `$${(DEMO_WORKSPACE.walletBalanceCents / 100).toLocaleString()}`,
  );

  const firstCollaboration = unwrap(
    "load first collaboration",
    await client
      .from("collaboration")
      .select("creator_id")
      .eq("workspace_id", context.workspaceId)
      .limit(1),
  ) as Array<{ creator_id: string }>;

  const logins = await seedDemoLogins(
    client,
    context.workspaceId,
    firstCollaboration[0].creator_id,
  );

  if (logins.length === 0) {
    console.log(
      "\nlogins      none — set SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD to attach one",
    );
  } else {
    console.log("\nlogins:");
    for (const note of logins) console.log(`  ${note}`);
  }
}

await main();
