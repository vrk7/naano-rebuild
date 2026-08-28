import { createClient } from "@/lib/supabase/server";
import {
  postEconomics,
  rollUpCompanies,
  sortByRelevance,
  type CompanyRollup,
  type EngagedPerson,
  type PostEconomics,
} from "./metrics";

/**
 * Loading for the post page (PRODUCT.md step 13).
 *
 * Every query runs as the signed-in user, so RLS decides what comes back — a
 * post belonging to another workspace is simply absent rather than filtered
 * here. Nothing in this file compares a workspace id.
 */

/** PostgREST caps a response at 1000 rows; a busy post exceeds that on matches. */
const PAGE_SIZE = 1000;

export type PostSummary = {
  readonly id: string;
  readonly publishedAt: string;
  readonly creatorName: string;
  readonly campaignName: string;
  readonly impressions: number;
  readonly economics: PostEconomics;
};

export type PostDetail = {
  readonly id: string;
  readonly publishedAt: string;
  readonly trackedUrl: string | null;
  readonly externalUrl: string;
  readonly body: string | null;
  readonly impressions: number;
  readonly reactions: number;
  readonly comments: number;
  readonly reposts: number;
  readonly creator: { id: string; name: string; headline: string | null; followers: number };
  readonly collaboration: { id: string; state: string; priceCents: number };
  readonly campaign: { id: string; name: string };
  readonly brief: { mode: string; body: string | null; requirements: unknown } | null;
  readonly people: ReadonlyArray<EngagedPerson>;
  readonly companies: ReadonlyArray<CompanyRollup>;
  readonly economics: PostEconomics;
};

/**
 * Pages through a query rather than trusting one response to be complete.
 *
 * A truncated list here would silently understate every number on the page —
 * fewer engaged people, fewer matches, and a cost per person that looks better
 * than it is. Wrong in the flattering direction is the worst kind.
 */
async function fetchAllRows<T>(
  runPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await runPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} failed: ${error.message}`);
    if (!data) throw new Error(`${label} returned no data`);

    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

/** Narrows one nested Supabase relation, which types as unknown without generated types. */
function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Post data is missing ${what}`);
  }
  return value;
}

const POST_SELECT = `
  id, published_at, tracked_url,
  creator_post:creator_post_id (
    body, impressions, reactions, comments, reposts, external_url
  ),
  collaboration:collaboration_id (
    id, price_cents, state,
    creator:creator_id ( id, display_name, headline, followers ),
    campaign:campaign_id ( id, name, brief ( mode, body, requirements ) )
  )
`;

type RawPost = {
  id: string;
  published_at: string;
  tracked_url: string | null;
  creator_post: unknown;
  collaboration: unknown;
};

/** Everyone who engaged with a post, with their ICP matches attached. */
async function loadPeopleFor(postId: string): Promise<EngagedPerson[]> {
  const supabase = await createClient();

  const engagements = await fetchAllRows<{
    kind: string;
    person: unknown;
  }>(
    (from, to) =>
      supabase
        .from("engagement")
        .select(
          "kind, person:person_id ( id, full_name, role_title, seniority, company:company_id ( id, name, country ) )",
        )
        .eq("post_id", postId)
        .order("occurred_at", { ascending: true })
        .range(from, to),
    "load engagements",
  );

  type PersonRow = {
    id: string;
    full_name: string;
    role_title: string | null;
    seniority: string | null;
    company: unknown;
  };

  // A person may react and comment on the same post; that is one lead with two
  // engagement kinds, not two leads.
  const byPerson = new Map<string, { row: PersonRow; kinds: string[] }>();

  for (const engagement of engagements) {
    const row = one<PersonRow>(engagement.person);
    if (!row) continue;

    const existing = byPerson.get(row.id);
    if (existing) {
      if (!existing.kinds.includes(engagement.kind)) existing.kinds.push(engagement.kind);
      continue;
    }
    byPerson.set(row.id, { row, kinds: [engagement.kind] });
  }

  const personIds = [...byPerson.keys()];
  if (personIds.length === 0) return [];

  const matches = await fetchAllRows<{
    person_id: string;
    score: number;
    icp: unknown;
  }>(
    (from, to) =>
      supabase
        .from("icp_match")
        .select("person_id, score, icp:icp_id ( id, label, rank )")
        .in("person_id", personIds)
        .order("score", { ascending: false })
        .range(from, to),
    "load ICP matches",
  );

  type IcpRow = { id: string; label: string; rank: number };
  const matchesByPerson = new Map<string, EngagedPerson["matches"][number][]>();

  for (const match of matches) {
    const icp = one<IcpRow>(match.icp);
    if (!icp) continue;

    const list = matchesByPerson.get(match.person_id) ?? [];
    list.push({ icpId: icp.id, icpLabel: icp.label, icpRank: icp.rank, score: match.score });
    matchesByPerson.set(match.person_id, list);
  }

  type CompanyRow = { id: string; name: string; country: string | null };

  return [...byPerson.values()].map(({ row, kinds }) => {
    const company = one<CompanyRow>(row.company);
    return {
      id: row.id,
      fullName: row.full_name,
      roleTitle: row.role_title,
      seniority: row.seniority,
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      companyCountry: company?.country ?? null,
      matches: (matchesByPerson.get(row.id) ?? []).sort((a, b) => b.score - a.score),
      engagementKinds: kinds,
    };
  });
}

export async function loadPostDetail(postId: string): Promise<PostDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("post")
    .select(POST_SELECT)
    .eq("id", postId)
    .maybeSingle();

  if (error) throw new Error(`Could not load post: ${error.message}`);
  // Absent means either no such post or one this workspace may not see. The
  // page renders a 404 for both; distinguishing them would leak its existence.
  if (!data) return null;

  const raw = data as unknown as RawPost;

  type CreatorPostRow = {
    body: string | null;
    impressions: number;
    reactions: number;
    comments: number;
    reposts: number;
    external_url: string;
  };
  type CollaborationRow = {
    id: string;
    price_cents: number;
    state: string;
    creator: unknown;
    campaign: unknown;
  };
  type CreatorRow = { id: string; display_name: string; headline: string | null; followers: number };
  type CampaignRow = { id: string; name: string; brief: unknown };
  type BriefRow = { mode: string; body: string | null; requirements: unknown };

  const creatorPost = required(one<CreatorPostRow>(raw.creator_post), "its LinkedIn post");
  const collaboration = required(one<CollaborationRow>(raw.collaboration), "its collaboration");
  const creator = required(one<CreatorRow>(collaboration.creator), "its creator");
  const campaign = required(one<CampaignRow>(collaboration.campaign), "its campaign");
  const brief = one<BriefRow>(campaign.brief);

  const people = sortByRelevance(await loadPeopleFor(postId));

  return {
    id: raw.id,
    publishedAt: raw.published_at,
    trackedUrl: raw.tracked_url,
    externalUrl: creatorPost.external_url,
    body: creatorPost.body,
    impressions: creatorPost.impressions,
    reactions: creatorPost.reactions,
    comments: creatorPost.comments,
    reposts: creatorPost.reposts,
    creator: {
      id: creator.id,
      name: creator.display_name,
      headline: creator.headline,
      followers: creator.followers,
    },
    collaboration: {
      id: collaboration.id,
      state: collaboration.state,
      priceCents: collaboration.price_cents,
    },
    campaign: { id: campaign.id, name: campaign.name },
    brief: brief
      ? { mode: brief.mode, body: brief.body, requirements: brief.requirements }
      : null,
    people,
    companies: rollUpCompanies(people),
    economics: postEconomics(collaboration.price_cents, people),
  };
}

/** The index. Loads each post's people because the headline number is cost per matched person. */
export async function loadPostSummaries(): Promise<PostSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("post")
    .select(POST_SELECT)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Could not load posts: ${error.message}`);

  const summaries: PostSummary[] = [];

  for (const row of (data ?? []) as unknown as RawPost[]) {
    const creatorPost = one<{ impressions: number }>(row.creator_post);
    const collaboration = one<{ price_cents: number; creator: unknown; campaign: unknown }>(
      row.collaboration,
    );
    if (!creatorPost || !collaboration) continue;

    const creator = one<{ display_name: string }>(collaboration.creator);
    const campaign = one<{ name: string }>(collaboration.campaign);
    const people = await loadPeopleFor(row.id);

    summaries.push({
      id: row.id,
      publishedAt: row.published_at,
      creatorName: creator?.display_name ?? "Unknown creator",
      campaignName: campaign?.name ?? "Unknown campaign",
      impressions: creatorPost.impressions,
      economics: postEconomics(collaboration.price_cents, people),
    });
  }

  return summaries;
}
