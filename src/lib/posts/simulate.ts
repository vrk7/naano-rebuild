import "server-only";

import { distributionFromFacets } from "./audience-distribution";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadContext,
  type Client,
  type IcpWithTargets,
  type PostRow,
} from "./simulation-context";
import { createRng, hashSeed, randomInt } from "@/lib/seed/random";
import {
  PersonPool,
  createSeedEngagementSource,
  type GeneratedEngagement,
  type GeneratedPerson,
} from "@/lib/seed/engagement";
import { scorePerson } from "@/lib/score/person";
import type { ScoreDimension } from "@/lib/score/weights";

/**
 * Engagement arriving on a published post (PRODUCT.md step 12).
 *
 * The sampler itself is `EngagementSource` and already existed — it was only
 * ever called by the demo seed, so a collaboration published through the UI
 * reached step 13 with nothing on it. This is the runtime caller of that same
 * seam. SCOPE.md: "a real scraper implements this later; nothing above it knows
 * the difference", and that holds here — swapping the source is the only change
 * this file would need.
 *
 * It writes with the service-role client. `engagement`, `person`, `company` and
 * `icp_match` carry SELECT-only policies on purpose: engagement is evidence,
 * and a session that could write its own would make the post page worthless.
 * So this is trusted server work, reached only from the publish action and
 * never from a request carrying user input.
 */

/** Matches below this are not stored. Mirrors the seed's floor. */
const ICP_MATCH_STORE_FLOOR = 1;

/** Impressions run well ahead of engagement, as they do on LinkedIn. */
const IMPRESSIONS_PER_ENGAGEMENT_MIN = 18;
const IMPRESSIONS_PER_ENGAGEMENT_MAX = 46;

/** Supabase rejects very large single inserts; 500 rows is comfortably under. */
const INSERT_CHUNK = 500;

const COMPANY_PREFIXES = [
  "Vantage", "Meridian", "Kessler", "Northwind", "Orbit", "Lumen", "Corva",
  "Tessellate", "Beacon", "Halden", "Arcadia", "Sundial",
];
const COMPANY_SUFFIXES = [
  "Industries", "Systems", "Group", "Works", "Partners", "Labs", "Holdings",
  "Manufacturing", "Logistics", "Technologies",
];
const SIZE_BANDS = ["11-50", "51-200", "201-500", "501-1000", "1001-5000"];

export type SimulationResult =
  | { readonly kind: "written"; readonly engagements: number; readonly people: number }
  /** Already simulated. Publishing is idempotent and so is this. */
  | { readonly kind: "already" }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Generates and stores one post's engagement.
 *
 * Deterministic in the post id, so re-running against a wiped post reproduces
 * the same people rather than a second unrelated crowd.
 */
export async function simulateEngagement(
  collaborationId: string,
): Promise<SimulationResult> {
  const client = createAdminClient();

  const context = await loadContext(client, collaborationId);
  if (context.kind === "refused") return context;

  const { post, creator, facets, icps } = context;

  // Idempotency. Publishing cannot happen twice, but a retried action or a
  // re-run after a partial failure must not deal a second crowd onto the post.
  const { count, error: countError } = await client
    .from("engagement")
    .select("id", { count: "exact", head: true })
    .eq("post_id", post.id);
  if (countError) {
    throw new Error(`Could not check existing engagement: ${countError.message}`);
  }
  if ((count ?? 0) > 0) return { kind: "already" };

  const distribution = distributionFromFacets(facets);
  if (distribution.kind === "incomplete") {
    return {
      kind: "refused",
      reason:
        `This creator's audience snapshot has nothing recorded for ` +
        `${distribution.missing.join(", ")}, so there is no distribution to draw ` +
        `engagement from. Nothing was invented to fill the gap.`,
    };
  }

  const engagements = createSeedEngagementSource(new PersonPool()).engagementsFor({
    seed: `post:${post.id}`,
    followers: creator.followers,
    publishedAt: post.publishedAt,
    audience: distribution.distribution,
  });

  if (engagements.length === 0) return { kind: "refused", reason: "The sampler produced no engagement." };

  const people = new Map<string, GeneratedPerson>();
  for (const entry of engagements) people.set(entry.person.key, entry.person);

  const companyIds = await upsertCompanies(client, [...people.values()]);
  const personIds = await insertPeople(client, post.id, [...people.values()], companyIds);

  await insertChunked(
    client,
    "engagement",
    engagements.map((entry) => ({
      post_id: post.id,
      person_id: personIds.get(entry.person.key)!,
      kind: entry.kind,
      occurred_at: entry.occurredAt.toISOString(),
    })),
  );

  await writeMatches(client, [...people.values()], personIds, icps);
  await updateCounters(client, post, engagements);

  return { kind: "written", engagements: engagements.length, people: people.size };
}

// --- Writing -----------------------------------------------------------------

async function insertChunked(
  client: Client,
  table: string,
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await client.from(table).insert(rows.slice(i, i + INSERT_CHUNK));
    if (error) throw new Error(`Could not write ${table}: ${error.message}`);
  }
}

/**
 * Companies are keyed by (industry, country, slot) rather than by post, so two
 * posts that reach the same segment roll up to the same employer. The `sim-`
 * prefix keeps them from colliding with the demo seed's `demo-` rows.
 */
async function upsertCompanies(
  client: Client,
  people: ReadonlyArray<GeneratedPerson>,
): Promise<Map<string, string>> {
  const keys = [...new Set(people.map((person) => person.companyKey))];

  const rows = keys.map((key) => {
    const [industryTopicId, geo] = key.split(":");
    const rng = createRng(hashSeed(`company:${key}`));
    return {
      name: `${COMPANY_PREFIXES[Math.floor(rng() * COMPANY_PREFIXES.length)]} ${
        COMPANY_SUFFIXES[Math.floor(rng() * COMPANY_SUFFIXES.length)]
      }`,
      domain: `sim-${key.replace(/:/g, "-")}.example`,
      industry_id: industryTopicId,
      size_band: SIZE_BANDS[Math.floor(rng() * SIZE_BANDS.length)],
      country: geo,
    };
  });

  const { error } = await client
    .from("company")
    .upsert(rows, { onConflict: "domain", ignoreDuplicates: true });
  if (error) throw new Error(`Could not write companies: ${error.message}`);

  const { data, error: readError } = await client
    .from("company")
    .select("id, domain")
    .in("domain", rows.map((row) => row.domain));
  if (readError) throw new Error(`Could not read companies back: ${readError.message}`);

  const byDomain = new Map((data ?? []).map((row) => [row.domain as string, row.id as string]));
  const byKey = new Map<string, string>();
  for (const key of keys) {
    const id = byDomain.get(`sim-${key.replace(/:/g, "-")}.example`);
    if (!id) throw new Error(`Company ${key} was written but could not be read back.`);
    byKey.set(key, id);
  }
  return byKey;
}

/**
 * People are scoped to the post.
 *
 * The pool that produces cross-post repeat engagers is a seed-time construct —
 * it lives for one run of the seed script. At runtime each post draws a fresh
 * crowd, so the same person never appears on two posts. That matters for step
 * 14 (leads aggregated across posts) and not for step 13, and inventing an
 * identity match here would be a claim about who these people are that nothing
 * supports.
 */
async function insertPeople(
  client: Client,
  postId: string,
  people: ReadonlyArray<GeneratedPerson>,
  companyIds: Map<string, string>,
): Promise<Map<string, string>> {
  const rows = people.map((person) => ({
    full_name: person.fullName,
    headline: person.headline,
    role_title: person.roleTitle,
    seniority: person.seniority,
    linkedin_url: `https://example.invalid/sim/${postId}/${person.key}`,
    company_id: companyIds.get(person.companyKey) ?? null,
  }));

  await insertChunked(client, "person", rows);

  const { data, error } = await client
    .from("person")
    .select("id, linkedin_url")
    .in("linkedin_url", rows.map((row) => row.linkedin_url));
  if (error) throw new Error(`Could not read people back: ${error.message}`);

  const byUrl = new Map((data ?? []).map((row) => [row.linkedin_url as string, row.id as string]));
  const byKey = new Map<string, string>();
  for (const person of people) {
    const id = byUrl.get(`https://example.invalid/sim/${postId}/${person.key}`);
    if (!id) throw new Error(`Person ${person.key} was written but could not be read back.`);
    byKey.set(person.key, id);
  }
  return byKey;
}

/**
 * One row per (person, ICP) they score anything against.
 *
 * A zero is not stored: a row saying "this person matches nothing you asked
 * for" is the absence itself, and the post page already reads a missing row
 * that way.
 */
async function writeMatches(
  client: Client,
  people: ReadonlyArray<GeneratedPerson>,
  personIds: Map<string, string>,
  icps: ReadonlyArray<IcpWithTargets>,
): Promise<void> {
  if (icps.length === 0) return;

  const matches: Array<Record<string, unknown>> = [];

  for (const person of people) {
    const point: Record<ScoreDimension, string> = {
      job_function: person.jobFunction,
      seniority: person.seniority,
      industry: person.industryTopicId,
      geo: person.geo,
    };

    for (const icp of icps) {
      const { value, matched } = scorePerson(point, icp.targets);
      if (value < ICP_MATCH_STORE_FLOOR) continue;
      matches.push({
        person_id: personIds.get(person.key)!,
        icp_id: icp.id,
        score: value,
        reasons: { matched_dimensions: matched },
      });
    }
  }

  if (matches.length === 0) return;

  const { error } = await client
    .from("icp_match")
    .upsert(matches, { onConflict: "person_id,icp_id", ignoreDuplicates: true });
  if (error) throw new Error(`Could not write ICP matches: ${error.message}`);
}

/** The counters the post page reads, derived from what was actually drawn. */
async function updateCounters(
  client: Client,
  post: PostRow,
  engagements: ReadonlyArray<GeneratedEngagement>,
): Promise<void> {
  const rng = createRng(hashSeed(`impressions:${post.id}`));

  const { error } = await client
    .from("creator_post")
    .update({
      impressions:
        engagements.length *
        randomInt(rng, IMPRESSIONS_PER_ENGAGEMENT_MIN, IMPRESSIONS_PER_ENGAGEMENT_MAX),
      reactions: engagements.filter((entry) => entry.kind === "reaction").length,
      comments: engagements.filter((entry) => entry.kind === "comment").length,
      reposts: engagements.filter((entry) => entry.kind === "repost").length,
    })
    .eq("id", post.creatorPostId);

  if (error) throw new Error(`Could not update the post's counters: ${error.message}`);
}
