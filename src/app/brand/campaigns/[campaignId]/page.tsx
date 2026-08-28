import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefPanel } from "@/components/campaign/brief-panel";
import { loadCampaign } from "@/lib/campaign/queries";
import { buildTaxonomyLookup } from "@/lib/score/labels";

export async function generateMetadata({ params }: PageProps<"/brand/campaigns/[campaignId]">) {
  const { campaignId } = await params;
  const campaign = await loadCampaign(campaignId);
  return { title: campaign?.name ?? "Campaign" };
}

export default async function CampaignPage({
  params,
}: PageProps<"/brand/campaigns/[campaignId]">) {
  const { campaignId } = await params;
  const campaign = await loadCampaign(campaignId);

  // Also the answer when the campaign belongs to another workspace: RLS returns
  // nothing and the page cannot tell the difference, which is the point.
  if (!campaign) notFound();

  const taxonomy = buildTaxonomyLookup([]);
  const created = new Date(campaign.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/brand"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Campaigns
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {campaign.status}
          </span>
        </div>
        {campaign.objective ? (
          <p className="mt-2 text-pretty text-muted-foreground">{campaign.objective}</p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          Created {created} ·{" "}
          {campaign.geos.length === 0
            ? "no geographic restriction"
            : campaign.geos.map((code) => taxonomy.labelFor("geo", code)).join(", ")}
          {campaign.collaborationCount > 0
            ? ` · ${campaign.collaborationCount} ${campaign.collaborationCount === 1 ? "collaboration" : "collaborations"}`
            : ""}
        </p>
      </header>

      <div className="mt-8">
        {campaign.brief ? (
          <BriefPanel
            mode={campaign.brief.mode}
            body={campaign.brief.body}
            requirements={campaign.brief.requirements}
          />
        ) : (
          /* Every campaign this product creates has a brief in the same submit,
             so reaching this means a row was written by something else — the
             seed, or a failed insert that could not be rolled back. Say that
             rather than render an empty brief panel. */
          <p className="rounded-lg border border-dashed border-border p-5 text-sm text-pretty text-muted-foreground">
            This campaign has no readable brief. Nothing in the product can create
            that state, so the row was written elsewhere or its mode is one this
            build does not have.
          </p>
        )}
      </div>

      <section className="mt-8 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Next</h2>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Find creators whose audience matches your ICPs, and book one against this
          campaign.
        </p>
        {/* The marketplace is not yet scoped to a campaign (PRODUCT.md step 5),
            so this links to the whole list rather than pretending to filter it. */}
        <Link
          href="/brand/creators"
          className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
        >
          Browse creators →
        </Link>
      </section>
    </main>
  );
}
