import Link from "next/link";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/callout";
import { Metric, MetricRow } from "@/components/ui/metric";
import { Page, PageHeader } from "@/components/ui/page";
import {
  TableFrame,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  CellNote,
} from "@/components/ui/table";
import { loadLeads, summariseLeads } from "@/lib/leads/queries";
import { formatPercent } from "@/lib/posts/metrics";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };

/**
 * Every lead across every post (PRODUCT.md step 14).
 *
 * The Source column is the point of the screen. Naano's open question is what
 * `Source` holds on one of their leads — post, campaign or creator
 * (`recon/NOTES.md`) — and ours holds the post, because that is the only answer
 * that lets a brand ask "which post brought this person in" and get a straight
 * reply.
 */
export default async function LeadsPage() {
  const leads = await loadLeads();
  const stats = summariseLeads(leads);

  return (
    <Page width="wide">
      <PageHeader
        title="Leads"
        description="Everyone who engaged with a published post, and which post brought them in."
        actions={
          leads.length > 0 ? (
            <Button asChild size="lg" variant="outline">
              {/* A plain link, not a fetch: the browser's own download handling
                  is what puts the file where the user expects it. */}
              <a href="/brand/leads/export" download>
                <Download aria-hidden />
                Export CSV
              </a>
            </Button>
          ) : null
        }
      />

      {leads.length === 0 ? (
        <EmptyState title="No leads yet" className="mt-6">
          Leads appear once a booked creator publishes and engagement lands on the
          post. Every row here is a person who engaged, with the post that reached
          them.
        </EmptyState>
      ) : (
        <>
          <MetricRow className="mt-6">
            <Metric label="Leads" value={stats.leads} />
            <Metric label="People" value={stats.people} note="some engaged twice" />
            <Metric label="Companies" value={stats.companies} />
            <Metric
              label="In ICP"
              value={stats.matched}
              note={formatPercent(stats.matchRate)}
            />
          </MetricRow>

          <TableFrame className="mt-6">
            <Table>
              <THead>
                <TR>
                  <TH>Person</TH>
                  <TH>Company</TH>
                  <TH>Source</TH>
                  <TH>Closest ICP</TH>
                  <TH numeric>Score</TH>
                </TR>
              </THead>
              <TBody>
                {leads.map((lead) => (
                  <TR key={lead.key} interactive>
                    <TD>
                      <span className="font-medium">{lead.fullName}</span>
                      <CellNote>
                        {lead.roleTitle ?? "—"}
                        {lead.engagementKinds.length > 1
                          ? ` · ${lead.engagementKinds.join(", ")}`
                          : ""}
                      </CellNote>
                    </TD>
                    <TD>
                      {lead.companyName ?? <span className="text-muted-foreground">—</span>}
                      {lead.companyCountry ? <CellNote>{lead.companyCountry}</CellNote> : null}
                    </TD>
                    <TD>
                      <Link
                        href={`/brand/posts/${lead.postId}`}
                        className="underline-offset-4 outline-none hover:underline focus-visible:underline"
                      >
                        {lead.creatorName}
                      </Link>
                      <CellNote>{lead.campaignName}</CellNote>
                    </TD>
                    <TD className={lead.isMatch ? undefined : "text-muted-foreground"}>
                      {lead.icpLabel ?? "No ICP scored"}
                    </TD>
                    <TD
                      numeric
                      className={cn(
                        "font-medium",
                        lead.isMatch ? "text-foreground" : "font-normal text-muted-foreground",
                      )}
                    >
                      {lead.score}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableFrame>

          {/* The distribution, stated rather than left to be inferred from
              scrolling — the same reason the marketplace prints its range. */}
          <p className="mt-3 max-w-prose text-sm text-pretty text-muted-foreground">
            {stats.matched === 0
              ? `None of these ${stats.leads} leads clears the match threshold. The posts reached people; they were not the people your ICPs asked for.`
              : `${stats.matched} of ${stats.leads} clear the match threshold. The rest are shown because a leads table that hid them would not be evidence of anything.`}
          </p>
        </>
      )}
    </Page>
  );
}
