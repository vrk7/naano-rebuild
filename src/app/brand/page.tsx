import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/callout";
import { Page, PageHeader } from "@/components/ui/page";
import { loadCampaigns } from "@/lib/campaign/queries";
import { loadWorkspace } from "@/lib/brand/queries";
import { buildTaxonomyLookup } from "@/lib/score/labels";

export const metadata = { title: "Campaigns" };

const MODE_LABEL = {
  specific: "Specific brief",
  creative_freedom: "Creative freedom",
} as const;

export default async function BrandHome() {
  /*
   * A brand account with no workspace has not been through onboarding: there is
   * no brand profile, no ICP and nothing to score. Every screen here would be an
   * empty version of itself, so it goes to the step that fixes that instead of
   * rendering "no campaigns yet" at someone who cannot make one.
   */
  if (!(await loadWorkspace())) redirect("/brand/setup");

  // Scoped by RLS to the workspaces this session belongs to, so no explicit
  // workspace filter is needed or trusted here.
  const campaigns = await loadCampaigns();
  const taxonomy = buildTaxonomyLookup([]);

  return (
    <Page>
      <PageHeader
        title="Campaigns"
        description="A campaign and its brief exist before anyone is booked."
        actions={
          <Button asChild size="lg">
            <Link href="/brand/campaigns/new">New campaign</Link>
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          className="mt-6"
          action={
            <Button asChild size="lg">
              <Link href="/brand/campaigns/new">Start one</Link>
            </Button>
          }
        >
          The brief can be a single line.
        </EmptyState>
      ) : (
        <ul className="mt-6 space-y-2">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/brand/campaigns/${campaign.id}`}
                className="block rounded-lg border border-border p-3.5 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/25"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-md font-medium">{campaign.name}</span>
                  <Badge variant="outline">{campaign.status}</Badge>
                </div>

                {campaign.objective ? (
                  <p className="mt-1 line-clamp-2 text-sm text-pretty text-muted-foreground">
                    {campaign.objective}
                  </p>
                ) : null}

                <p className="mt-2 text-xs text-muted-foreground">
                  {campaign.briefMode ? MODE_LABEL[campaign.briefMode] : "No readable brief"}
                  {/* Says how many rules a draft will actually be measured
                      against, so a specific brief that requires nothing is not
                      mistaken for one that does. */}
                  {campaign.briefMode === "specific"
                    ? campaign.requirementCount === 0
                      ? " · no requirements set"
                      : ` · ${campaign.requirementCount} ${campaign.requirementCount === 1 ? "requirement" : "requirements"}`
                    : ""}
                  {campaign.geos.length > 0
                    ? ` · ${campaign.geos.map((code) => taxonomy.labelFor("geo", code)).join(", ")}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
