import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { ICP_MATCH_THRESHOLD } from "@/lib/score/weights";

/**
 * Leads (PRODUCT.md step 14): "the same data aggregated across every post, with
 * Source being the post".
 *
 * A lead is a person *and* the post they engaged with, not a person on their
 * own. PRODUCT.md is explicit that "a lead is a person with an engagement on a
 * post. Its source is therefore always a specific post, which is the whole
 * claim" — so somebody who engaged with two posts is two leads with two
 * sources, and collapsing them into one row would throw away the only column
 * that makes this table an argument rather than a contact list.
 *
 * Every query runs as the signed-in user. RLS walks engagement -> post ->
 * collaboration to decide what comes back, so nothing here compares a workspace
 * id and there is no way to widen the result by passing one.
 */

export type Lead = {
  /** Unique per row: the same person on two posts is two leads. */
  readonly key: string;
  readonly personId: string;
  readonly fullName: string;
  readonly roleTitle: string | null;
  readonly seniority: string | null;
  readonly companyName: string | null;
  readonly companyCountry: string | null;
  readonly engagementKinds: ReadonlyArray<string>;
  readonly firstEngagedAt: string;
  /** The source. Always a specific post. */
  readonly postId: string;
  readonly creatorName: string;
  readonly campaignName: string;
  readonly publishedAt: string;
  /** Best ICP this person matched, or null when they matched none. */
  readonly icpLabel: string | null;
  readonly score: number;
  readonly isMatch: boolean;
};

type PersonRow = {
  id: string;
  full_name: string;
  role_title: string | null;
  seniority: string | null;
  company: unknown;
};

type CompanyRow = { id: string; name: string; country: string | null };
type IcpRow = { id: string; label: string; rank: number };

type PostRow = {
  id: string;
  published_at: string;
  collaboration: unknown;
};

function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

/**
 * Every lead in the workspace, best match first.
 *
 * Ordering puts the rows a brand can act on at the top while leaving the rest
 * in place below them. A leads table that only showed matches would be the
 * marketplace's constant-100 problem in another costume — the people a post
 * reached and should not have are the evidence that the number means anything.
 */
export async function loadLeads(): Promise<Lead[]> {
  const supabase = await createClient();

  const engagements = await fetchAllRows<{
    kind: string;
    occurred_at: string;
    post: unknown;
    person: unknown;
  }>(
    (from, to) =>
      supabase
        .from("engagement")
        .select(
          `kind, occurred_at,
           post:post_id (
             id, published_at,
             collaboration:collaboration_id (
               creator:creator_id ( display_name ),
               campaign:campaign_id ( name )
             )
           ),
           person:person_id (
             id, full_name, role_title, seniority,
             company:company_id ( id, name, country )
           )`,
        )
        .order("occurred_at", { ascending: true })
        .range(from, to),
    "load leads",
  );

  // Grouped by (person, post): one lead per person per source, carrying every
  // way they engaged with it.
  const byKey = new Map<
    string,
    { person: PersonRow; post: PostRow; kinds: string[]; firstAt: string }
  >();

  for (const engagement of engagements) {
    const person = one<PersonRow>(engagement.person);
    const post = one<PostRow>(engagement.post);
    if (!person || !post) continue;

    const key = `${person.id}:${post.id}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.kinds.includes(engagement.kind)) existing.kinds.push(engagement.kind);
      continue;
    }
    // Rows arrive oldest first, so the first one seen is the first engagement.
    byKey.set(key, { person, post, kinds: [engagement.kind], firstAt: engagement.occurred_at });
  }

  if (byKey.size === 0) return [];

  const personIds = [...new Set([...byKey.values()].map((entry) => entry.person.id))];

  const matches = await fetchAllRows<{ person_id: string; score: number; icp: unknown }>(
    (from, to) =>
      supabase
        .from("icp_match")
        .select("person_id, score, icp:icp_id ( id, label, rank )")
        .in("person_id", personIds)
        .order("score", { ascending: false })
        .range(from, to),
    "load ICP matches",
  );

  const bestByPerson = new Map<string, { label: string; score: number }>();
  for (const match of matches) {
    const icp = one<IcpRow>(match.icp);
    if (!icp) continue;
    // Rows arrive score-descending, so the first one seen is the best.
    if (!bestByPerson.has(match.person_id)) {
      bestByPerson.set(match.person_id, { label: icp.label, score: match.score });
    }
  }

  const leads = [...byKey.entries()].map(([key, entry]) => {
    const company = one<CompanyRow>(entry.person.company);
    const collaboration = one<{ creator: unknown; campaign: unknown }>(
      entry.post.collaboration,
    );
    const creator = one<{ display_name: string }>(collaboration?.creator);
    const campaign = one<{ name: string }>(collaboration?.campaign);
    const best = bestByPerson.get(entry.person.id) ?? null;

    return {
      key,
      personId: entry.person.id,
      fullName: entry.person.full_name,
      roleTitle: entry.person.role_title,
      seniority: entry.person.seniority,
      companyName: company?.name ?? null,
      companyCountry: company?.country ?? null,
      engagementKinds: entry.kinds,
      firstEngagedAt: entry.firstAt,
      postId: entry.post.id,
      creatorName: creator?.display_name ?? "Unknown creator",
      campaignName: campaign?.name ?? "Unknown campaign",
      publishedAt: entry.post.published_at,
      icpLabel: best?.label ?? null,
      /*
       * No match row means no ICP scored this person above the store floor.
       * That is a real zero — the scoring ran and found nothing — unlike the
       * withheld scores on the marketplace, where the refusal is the answer.
       */
      score: best?.score ?? 0,
      isMatch: (best?.score ?? 0) >= ICP_MATCH_THRESHOLD,
    } satisfies Lead;
  });

  return leads.sort(
    (a, b) =>
      b.score - a.score ||
      a.fullName.localeCompare(b.fullName) ||
      a.postId.localeCompare(b.postId),
  );
}

/** The counts above the table, derived from the same rows it renders. */
export function summariseLeads(leads: ReadonlyArray<Lead>) {
  const people = new Set(leads.map((lead) => lead.personId));
  const companies = new Set(
    leads.map((lead) => lead.companyName).filter((name): name is string => name !== null),
  );
  const matched = leads.filter((lead) => lead.isMatch);

  return {
    leads: leads.length,
    people: people.size,
    companies: companies.size,
    matched: matched.length,
    /** Null rather than zero when there is nothing to divide by. */
    matchRate: leads.length > 0 ? matched.length / leads.length : null,
  };
}
