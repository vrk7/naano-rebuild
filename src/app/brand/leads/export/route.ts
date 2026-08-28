import { toCsv } from "@/lib/leads/csv";
import { loadLeads } from "@/lib/leads/queries";

/**
 * The leads export (PRODUCT.md step 14, "Export to CSV").
 *
 * A route handler rather than a server action because the result is a file, not
 * a state change: the browser's own download handling is what puts it where the
 * user expects, and an action would have to round-trip the whole table through
 * React state to get there.
 *
 * It reads through `loadLeads`, which runs as the signed-in user, so RLS decides
 * what is in the file. There is no workspace argument to tamper with, and an
 * unauthenticated request is redirected to the login screen by the proxy before
 * it reaches this handler at all.
 */

const HEADER = [
  "name",
  "role",
  "seniority",
  "company",
  "country",
  "engagement",
  "first_engaged_at",
  "source_creator",
  "source_campaign",
  "source_post_id",
  "published_at",
  "closest_icp",
  "score",
  "in_icp",
] as const;

export async function GET(): Promise<Response> {
  const leads = await loadLeads();

  const rows = leads.map((lead) => [
    lead.fullName,
    lead.roleTitle ?? "",
    lead.seniority ?? "",
    lead.companyName ?? "",
    lead.companyCountry ?? "",
    lead.engagementKinds.join(" "),
    lead.firstEngagedAt,
    lead.creatorName,
    lead.campaignName,
    lead.postId,
    lead.publishedAt,
    // Empty rather than a placeholder: no ICP scored this person, and writing
    // "none" would put a word in a column every other row fills with a label.
    lead.icpLabel ?? "",
    String(lead.score),
    lead.isMatch ? "yes" : "no",
  ]);

  const filename = `naano-leads-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(toCsv(HEADER, rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      // The file is one workspace's own data and changes whenever a post picks
      // up engagement; a cached copy would be both stale and cross-tenant.
      "cache-control": "no-store, private",
    },
  });
}
