/**
 * Seeds the topic taxonomy and the creator population.
 *
 * Run with:  npm run db:seed
 *
 * Idempotent. Topics and creators upsert on their natural keys (slug,
 * linkedin_url) and each creator's seed snapshot is replaced rather than
 * appended, so re-running converges instead of accumulating.
 *
 * Uses the service-role key and therefore bypasses RLS. It is a local
 * operator script, never imported by the app.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ALL_TOPICS } from "../src/lib/seed/taxonomy.ts";
import { generateCreators, type SeededCreator } from "../src/lib/seed/creators.ts";

/** PostgREST rejects very large payloads; facets run to a few thousand rows. */
const INSERT_BATCH = 500;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Run with: node --env-file=.env.local scripts/seed.ts`,
    );
  }
  return value;
}

/** Every Supabase call routes through here — a failed seed must not look empty. */
function unwrap<T>(label: string, result: { data: T | null; error: unknown }): T {
  if (result.error) {
    const detail =
      result.error instanceof Error
        ? result.error.message
        : JSON.stringify(result.error);
    throw new Error(`${label} failed: ${detail}`);
  }
  if (result.data === null) {
    throw new Error(`${label} returned no data`);
  }
  return result.data;
}

type FacetRow = {
  snapshot_id: string;
  dimension: string;
  value: string;
  share: number;
};

async function insertInBatches(
  client: SupabaseClient,
  table: string,
  rows: ReadonlyArray<FacetRow>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    const { error } = await client.from(table).insert(batch);
    if (error) {
      throw new Error(
        `insert into ${table} (rows ${i}-${i + batch.length}) failed: ${error.message}`,
      );
    }
  }
}

async function seedTopics(client: SupabaseClient): Promise<Map<string, string>> {
  const rows = ALL_TOPICS.map((t) => ({ slug: t.slug, label: t.label, kind: t.kind }));
  const { error } = await client.from("topic").upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`upsert topic failed: ${error.message}`);

  const data = unwrap(
    "select topic",
    await client.from("topic").select("id, slug"),
  );

  const bySlug = new Map<string, string>(
    (data as Array<{ id: string; slug: string }>).map((t) => [t.slug, t.id]),
  );

  for (const topic of ALL_TOPICS) {
    if (!bySlug.has(topic.slug)) {
      throw new Error(`topic ${topic.slug} missing after upsert`);
    }
  }
  return bySlug;
}

async function seedCreators(
  client: SupabaseClient,
  creators: ReadonlyArray<SeededCreator>,
): Promise<Map<string, string>> {
  const rows = creators.map((c) => ({
    display_name: c.displayName,
    headline: c.headline,
    country: c.country,
    linkedin_url: c.linkedinUrl,
    followers: c.followers,
  }));

  const { error } = await client
    .from("creator")
    .upsert(rows, { onConflict: "linkedin_url" });
  if (error) throw new Error(`upsert creator failed: ${error.message}`);

  const data = unwrap(
    "select creator",
    await client.from("creator").select("id, linkedin_url"),
  );

  return new Map(
    (data as Array<{ id: string; linkedin_url: string }>).map((c) => [
      c.linkedin_url,
      c.id,
    ]),
  );
}

async function seedTopicsAndRates(
  client: SupabaseClient,
  creators: ReadonlyArray<SeededCreator>,
  creatorIds: Map<string, string>,
  topicIds: Map<string, string>,
): Promise<void> {
  const links = creators.flatMap((c) =>
    c.topicSlugs.map((slug) => ({
      creator_id: creatorIds.get(c.linkedinUrl)!,
      topic_id: topicIds.get(slug)!,
    })),
  );
  const { error: linkError } = await client
    .from("creator_topic")
    .upsert(links, { onConflict: "creator_id,topic_id" });
  if (linkError) throw new Error(`upsert creator_topic failed: ${linkError.message}`);

  const rates = creators.map((c) => ({
    creator_id: creatorIds.get(c.linkedinUrl)!,
    kind: "single" as const,
    price_cents: c.priceCents,
    currency: "USD",
  }));
  const { error: rateError } = await client
    .from("creator_rate")
    .upsert(rates, { onConflict: "creator_id,kind" });
  if (rateError) throw new Error(`upsert creator_rate failed: ${rateError.message}`);
}

async function seedSnapshots(
  client: SupabaseClient,
  creators: ReadonlyArray<SeededCreator>,
  creatorIds: Map<string, string>,
  topicIds: Map<string, string>,
): Promise<number> {
  const ids = creators.map((c) => creatorIds.get(c.linkedinUrl)!);

  // Replace rather than append: a snapshot has no natural key, so re-running
  // would otherwise stack a new audience on every creator each time. Facets
  // cascade with their snapshot.
  const { error: clearError } = await client
    .from("audience_snapshot")
    .delete()
    .eq("source", "seed")
    .in("creator_id", ids);
  if (clearError) throw new Error(`clear snapshots failed: ${clearError.message}`);

  const snapshotRows = creators.map((c) => ({
    creator_id: creatorIds.get(c.linkedinUrl)!,
    sample_size: c.sampleSize,
    posts_analyzed: c.postsAnalyzed,
    source: "seed" as const,
  }));

  const inserted = unwrap(
    "insert audience_snapshot",
    await client.from("audience_snapshot").insert(snapshotRows).select("id, creator_id"),
  ) as Array<{ id: string; creator_id: string }>;

  const snapshotByCreator = new Map(inserted.map((s) => [s.creator_id, s.id]));

  const facets = creators.flatMap((c) => {
    const snapshotId = snapshotByCreator.get(creatorIds.get(c.linkedinUrl)!)!;
    return c.facets.map((f) => ({
      snapshot_id: snapshotId,
      dimension: f.dimension,
      // Industry facets carry a slug until here; the score joins on topic id.
      value: f.dimension === "industry" ? topicIds.get(f.value)! : f.value,
      share: f.share,
    }));
  });

  await insertInBatches(client, "audience_facet", facets);
  return facets.length;
}

async function main(): Promise<void> {
  const client = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const creators = generateCreators();

  const topicIds = await seedTopics(client);
  console.log(`topics       ${topicIds.size}`);

  const creatorIds = await seedCreators(client, creators);
  console.log(`creators     ${creators.length}`);

  await seedTopicsAndRates(client, creators, creatorIds, topicIds);
  console.log(`rates        ${creators.length}`);

  const facetCount = await seedSnapshots(client, creators, creatorIds, topicIds);
  console.log(`snapshots    ${creators.length}`);
  console.log(`facets       ${facetCount}`);
}

await main();
