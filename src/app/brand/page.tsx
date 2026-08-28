import Link from "next/link";

import { loadCampaigns } from "@/lib/campaign/queries";
import { buildTaxonomyLookup } from "@/lib/score/labels";

export const metadata = { title: "Campaigns" };

const MODE_LABEL = {
  specific: "Specific brief",
  creative_freedom: "Creative freedom",
} as const;

export default async function BrandHome() {
  // Scoped by RLS to the workspaces this session belongs to, so no explicit
  // workspace filter is needed or trusted here.
  const campaigns = await loadCampaigns();
  const taxonomy = buildTaxonomyLookup([]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A campaign and its brief exist before anyone is booked.
          </p>
        </div>
        <Link
          href="/brand/campaigns/new"
          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
        >
          New campaign
        </Link>
      </header>

      {campaigns.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-6 text-sm text-pretty text-muted-foreground">
          No campaigns yet, or this account is not a member of a workspace. Start one
          and the brief can be a single line.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/brand/campaigns/${campaign.id}`}
                className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">{campaign.name}</span>
                  <span className="text-xs text-muted-foreground">{campaign.status}</span>
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
    </main>
  );
}
