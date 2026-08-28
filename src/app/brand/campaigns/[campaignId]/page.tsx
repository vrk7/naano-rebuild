import Link from "next/link";
import { notFound } from "next/navigation";

import { BookedList } from "@/components/collaboration/booked-list";
import { BriefPanel } from "@/components/campaign/brief-panel";
import { loadCampaign } from "@/lib/campaign/queries";
import { loadCampaignCollaborations } from "@/lib/collaboration/queries";
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

  const collaborations = await loadCampaignCollaborations(campaignId);

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

      {collaborations.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Booked</h2>
          <BookedList
            collaborations={collaborations}
            campaignId={campaign.id}
            now={new Date()}
          />
        </section>
      ) : null}

      <section className="mt-8 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Next</h2>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Creators scored against your ICPs, each showing how much of their audience
          is actually in{" "}
          {campaign.geos.length === 0
            ? "the regions you are running in — this campaign names none, so nothing is filtered by geography"
            : campaign.geos.map((code) => taxonomy.labelFor("geo", code)).join(", ")}
          .
        </p>
        <Link
          href={`/brand/campaigns/${campaign.id}/creators`}
          className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
        >
          Find creators for this campaign →
        </Link>
      </section>
    </main>
  );
}
