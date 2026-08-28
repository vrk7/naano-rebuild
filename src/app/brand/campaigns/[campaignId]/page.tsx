import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { BookedList } from "@/components/collaboration/booked-list";
import { BriefPanel } from "@/components/campaign/brief-panel";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink, Page, SectionHeader } from "@/components/ui/page";
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
    <Page>
      <BackLink href="/brand">Campaigns</BackLink>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-[-0.014em]">{campaign.name}</h1>
          <Badge variant="outline">{campaign.status}</Badge>
        </div>
        {campaign.objective ? (
          <p className="text-md mt-1.5 max-w-prose text-pretty text-muted-foreground">
            {campaign.objective}
          </p>
        ) : null}
        <p className="mt-1.5 text-sm text-muted-foreground">
          Created {created} ·{" "}
          {campaign.geos.length === 0
            ? "no geographic restriction"
            : campaign.geos.map((code) => taxonomy.labelFor("geo", code)).join(", ")}
          {campaign.collaborationCount > 0
            ? ` · ${campaign.collaborationCount} ${campaign.collaborationCount === 1 ? "collaboration" : "collaborations"}`
            : ""}
        </p>
      </header>

      <div className="mt-6">
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
          <Callout tone="warning">
            This campaign has no readable brief. Nothing in the product can create
            that state, so the row was written elsewhere or its mode is one this
            build does not have.
          </Callout>
        )}
      </div>

      {collaborations.length > 0 ? (
        <section className="mt-8">
          <SectionHeader title="Booked" meta={`${collaborations.length}`} />
          <BookedList
            collaborations={collaborations}
            campaignId={campaign.id}
            now={new Date()}
          />
        </section>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Next</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            Creators scored against your ICPs, each showing how much of their audience
            is actually in{" "}
            {campaign.geos.length === 0
              ? "the regions you are running in — this campaign names none, so nothing is filtered by geography"
              : campaign.geos.map((code) => taxonomy.labelFor("geo", code)).join(", ")}
            .
          </p>
          <Link
            href={`/brand/campaigns/${campaign.id}/creators`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            Find creators for this campaign
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </CardBody>
      </Card>
    </Page>
  );
}
