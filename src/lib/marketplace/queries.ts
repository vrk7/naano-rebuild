/**
 * Loading for the marketplace and the creator profile (PRODUCT.md steps 5–6).
 *
 * Every query runs as the signed-in user, so RLS decides what comes back. The
 * creator tables are readable by anyone signed in — that is what a marketplace
 * is — while `icp` and `icp_target` are workspace-scoped, so the targets a
 * creator is scored against are only ever this workspace's own. Nothing here
 * compares a workspace id.
 */

import { campaignReach, type CampaignReach } from "@/lib/campaign/reach";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { loadTopics } from "@/lib/taxonomy/queries";
import { buildTaxonomyLookup, type TaxonomyLookup } from "@/lib/score/labels";
import {
  scoreCreator,
  type AudienceFacet,
  type AudienceSnapshot,
  type IcpTarget,
} from "@/lib/score/creator";
import type { ScoreDimension } from "@/lib/score/weights";
import {
  bestIcpScore,
  type CreatorListing,
  type IcpScore,
  type IcpSummary,
  type RankedCreator,
} from "./ranking";

export type IcpWithTargets = IcpSummary & {
  readonly description: string | null;
  readonly targets: ReadonlyArray<IcpTarget>;
};

export type Marketplace = {
  readonly icps: ReadonlyArray<IcpWithTargets>;
  readonly creators: ReadonlyArray<RankedCreator>;
  readonly taxonomy: TaxonomyLookup;
};

/**
 * Scoping the marketplace to a campaign (PRODUCT.md step 5).
 *
 * Only the campaign's regions reach this far. The score is computed against the
 * workspace's ICPs either way — a campaign does not change who a brand sells
 * to — so scoping annotates and filters the list, and never moves a number.
 */
export type MarketplaceScope = {
  readonly campaignGeos: ReadonlyArray<string>;
};

export type CreatorPost = {
  readonly id: string;
  readonly externalUrl: string;
  readonly publishedAt: string;
  readonly body: string | null;
  readonly impressions: number;
  readonly reactions: number;
  readonly comments: number;
  readonly reposts: number;
  readonly isSponsored: boolean;
};

export type CreatorProfile = {
  readonly creator: CreatorListing;
  readonly snapshot: {
    readonly capturedAt: string;
    readonly source: string;
    readonly facets: ReadonlyArray<AudienceFacet>;
  };
  readonly icps: ReadonlyArray<IcpWithTargets>;
  readonly scores: ReadonlyArray<IcpScore>;
  /** Null when the workspace has no active ICPs, so there was nothing to score against. */
  readonly best: IcpScore | null;
  readonly posts: ReadonlyArray<CreatorPost>;
  /** Set only when the profile was opened from a campaign. */
  readonly campaignReach: CampaignReach | null;
  readonly taxonomy: TaxonomyLookup;
};

/**
 * The workspace's active ICPs with their targets.
 *
 * An empty result is a real answer — a workspace that has not finished
 * onboarding has no ICPs — and callers have to render that rather than a list
 * of zeros. Nothing can be scored against nothing.
 */
export async function loadActiveIcps(): Promise<IcpWithTargets[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("icp")
    .select("id, label, rank, description, icp_target ( dimension, value )")
    .eq("is_active", true)
    .order("rank", { ascending: true });

  if (error) throw new Error(`Could not load ICPs: ${error.message}`);
  if (!data) throw new Error("ICP query returned no data");

  return data.map((row) => {
    const targets = (row.icp_target ?? []) as Array<{ dimension: string; value: string }>;
    return {
      id: row.id as string,
      label: row.label as string,
      rank: row.rank as number,
      description: (row.description ?? null) as string | null,
      targets: targets.map((t) => ({
        dimension: t.dimension as ScoreDimension,
        value: t.value,
      })),
    };
  });
}

type SnapshotRow = {
  id: string;
  creator_id: string;
  captured_at: string;
  sample_size: number;
  posts_analyzed: number;
  source: string;
};

/**
 * The current audience snapshot for each creator.
 *
 * `audience_snapshot` is append-only history, so "current" means most recently
 * captured. The rows come back newest-first and the first one seen per creator
 * wins; scoring an older snapshot would quietly answer a question about last
 * month.
 */
async function loadLatestSnapshots(
  creatorIds?: ReadonlyArray<string>,
): Promise<Map<string, SnapshotRow>> {
  const supabase = await createClient();

  const rows = await fetchAllRows<SnapshotRow>(
    (from, to) => {
      const query = supabase
        .from("audience_snapshot")
        .select("id, creator_id, captured_at, sample_size, posts_analyzed, source")
        .order("captured_at", { ascending: false })
        .range(from, to);
      return creatorIds ? query.in("creator_id", creatorIds) : query;
    },
    "load audience snapshots",
  );

  const latest = new Map<string, SnapshotRow>();
  for (const row of rows) {
    if (!latest.has(row.creator_id)) latest.set(row.creator_id, row);
  }
  return latest;
}

/**
 * Facets for a set of snapshots, grouped by snapshot.
 *
 * `share` is `numeric(5,4)`, which PostgREST may hand back as a number or a
 * string depending on driver version. It is coerced once here; anything that
 * does not survive the coercion arrives at `scoreCreator` as NaN and throws
 * there rather than scoring as zero.
 */
async function loadFacets(
  snapshotIds: ReadonlyArray<string>,
): Promise<Map<string, AudienceFacet[]>> {
  const bySnapshot = new Map<string, AudienceFacet[]>();
  if (snapshotIds.length === 0) return bySnapshot;

  const supabase = await createClient();

  const rows = await fetchAllRows<{
    snapshot_id: string;
    dimension: string;
    value: string;
    share: number | string;
  }>(
    (from, to) =>
      supabase
        .from("audience_facet")
        .select("snapshot_id, dimension, value, share")
        .in("snapshot_id", snapshotIds)
        .order("share", { ascending: false })
        .range(from, to),
    "load audience facets",
  );

  for (const row of rows) {
    const list = bySnapshot.get(row.snapshot_id) ?? [];
    list.push({
      dimension: row.dimension as ScoreDimension,
      value: row.value,
      share: Number(row.share),
    });
    bySnapshot.set(row.snapshot_id, list);
  }

  return bySnapshot;
}

type CreatorRow = {
  id: string;
  display_name: string;
  headline: string | null;
  country: string | null;
  followers: number;
};

async function loadRates(): Promise<Map<string, { priceCents: number; currency: string }>> {
  const supabase = await createClient();

  const rows = await fetchAllRows<{
    creator_id: string;
    price_cents: number;
    currency: string;
  }>(
    (from, to) =>
      supabase
        .from("creator_rate")
        .select("creator_id, price_cents, currency")
        .eq("kind", "single")
        .range(from, to),
    "load creator rates",
  );

  return new Map(
    rows.map((r) => [r.creator_id, { priceCents: r.price_cents, currency: r.currency }]),
  );
}

async function loadCreatorTopics(): Promise<Map<string, string[]>> {
  const supabase = await createClient();

  const rows = await fetchAllRows<{ creator_id: string; topic_id: string }>(
    (from, to) =>
      supabase.from("creator_topic").select("creator_id, topic_id").range(from, to),
    "load creator topics",
  );

  const byCreator = new Map<string, string[]>();
  for (const row of rows) {
    const list = byCreator.get(row.creator_id) ?? [];
    list.push(row.topic_id);
    byCreator.set(row.creator_id, list);
  }
  return byCreator;
}

function listingFrom(
  row: CreatorRow,
  snapshot: SnapshotRow,
  rate: { priceCents: number; currency: string } | undefined,
  topics: ReadonlyArray<string>,
): CreatorListing {
  return {
    id: row.id,
    displayName: row.display_name,
    headline: row.headline,
    country: row.country,
    followers: row.followers,
    priceCents: rate?.priceCents ?? null,
    currency: rate?.currency ?? null,
    topics,
    sampleSize: snapshot.sample_size,
    postsAnalyzed: snapshot.posts_analyzed,
  };
}

function scoreAgainstAll(
  audience: AudienceSnapshot,
  icps: ReadonlyArray<IcpWithTargets>,
): IcpScore[] {
  return icps.map((icp) => ({
    icp: { id: icp.id, label: icp.label, rank: icp.rank },
    score: scoreCreator(audience, icp.targets),
  }));
}

/**
 * The marketplace list, scored against every active ICP in the workspace.
 *
 * Creators with no audience snapshot are dropped rather than listed with a zero
 * or a placeholder. There is no observation to score, and inventing one is the
 * failure PRODUCT.md opens with.
 */
export async function loadMarketplace(scope?: MarketplaceScope): Promise<Marketplace> {
  const supabase = await createClient();

  const [topics, icps] = await Promise.all([loadTopics(), loadActiveIcps()]);
  const taxonomy = buildTaxonomyLookup(topics);

  if (icps.length === 0) return { icps, creators: [], taxonomy };

  const creatorRows = await fetchAllRows<CreatorRow>(
    (from, to) =>
      supabase
        .from("creator")
        .select("id, display_name, headline, country, followers")
        .range(from, to),
    "load creators",
  );

  const snapshots = await loadLatestSnapshots();
  const [facets, rates, creatorTopics] = await Promise.all([
    loadFacets([...snapshots.values()].map((s) => s.id)),
    loadRates(),
    loadCreatorTopics(),
  ]);

  const creators: RankedCreator[] = [];

  for (const row of creatorRows) {
    const snapshot = snapshots.get(row.id);
    if (!snapshot) continue;

    const audience: AudienceSnapshot = {
      sampleSize: snapshot.sample_size,
      postsAnalyzed: snapshot.posts_analyzed,
      facets: facets.get(snapshot.id) ?? [],
    };

    const scores = scoreAgainstAll(audience, icps);
    creators.push({
      creator: listingFrom(row, snapshot, rates.get(row.id), creatorTopics.get(row.id) ?? []),
      scores,
      best: bestIcpScore(scores),
      campaignReach: scope ? campaignReach(audience.facets, scope.campaignGeos) : null,
    });
  }

  return { icps, creators, taxonomy };
}

/** One creator, with the working for every active ICP. Null when there is no such creator. */
export async function loadCreatorProfile(
  creatorId: string,
  scope?: MarketplaceScope,
): Promise<CreatorProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creator")
    .select("id, display_name, headline, country, followers")
    .eq("id", creatorId)
    .maybeSingle();

  if (error) throw new Error(`Could not load creator: ${error.message}`);
  if (!data) return null;

  const row = data as CreatorRow;
  const [topics, icps] = await Promise.all([loadTopics(), loadActiveIcps()]);
  const taxonomy = buildTaxonomyLookup(topics);

  const snapshot = (await loadLatestSnapshots([row.id])).get(row.id);
  // A creator with no snapshot is unreachable from the marketplace, which drops
  // them, but the URL is guessable. Say what is missing rather than render a
  // profile whose every number is invented.
  if (!snapshot) return null;

  const [facetsBySnapshot, rates, creatorTopics, posts] = await Promise.all([
    loadFacets([snapshot.id]),
    loadRates(),
    loadCreatorTopics(),
    loadCreatorPosts(row.id),
  ]);

  const facets = facetsBySnapshot.get(snapshot.id) ?? [];
  const audience: AudienceSnapshot = {
    sampleSize: snapshot.sample_size,
    postsAnalyzed: snapshot.posts_analyzed,
    facets,
  };

  const scores = scoreAgainstAll(audience, icps);

  return {
    creator: listingFrom(row, snapshot, rates.get(row.id), creatorTopics.get(row.id) ?? []),
    snapshot: { capturedAt: snapshot.captured_at, source: snapshot.source, facets },
    icps,
    scores,
    best: scores.length > 0 ? bestIcpScore(scores) : null,
    posts,
    campaignReach: scope ? campaignReach(facets, scope.campaignGeos) : null,
    taxonomy,
  };
}

async function loadCreatorPosts(creatorId: string): Promise<CreatorPost[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creator_post")
    .select(
      "id, external_url, published_at, body, impressions, reactions, comments, reposts, is_sponsored",
    )
    .eq("creator_id", creatorId)
    .order("published_at", { ascending: false })
    .limit(5);

  if (error) throw new Error(`Could not load creator posts: ${error.message}`);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    externalUrl: p.external_url as string,
    publishedAt: p.published_at as string,
    body: (p.body ?? null) as string | null,
    impressions: p.impressions as number,
    reactions: p.reactions as number,
    comments: p.comments as number,
    reposts: p.reposts as number,
    isSponsored: p.is_sponsored as boolean,
  }));
}
