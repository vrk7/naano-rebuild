import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { SUPPORTED_REGIONS } from "@/lib/geo/regions";
import { buildTaxonomyLookup } from "@/lib/score/labels";

import { CampaignForm } from "./campaign-form";

export const metadata = { title: "New campaign" };

export default function NewCampaignPage() {
  // No topics are needed to name a region, so the lookup is built empty rather
  // than paying for a query whose rows this screen never reads.
  const taxonomy = buildTaxonomyLookup([]);

  const regions = SUPPORTED_REGIONS.map((code) => ({
    code,
    label: taxonomy.labelFor("geo", code),
  })).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Page width="narrow">
      <BackLink href="/brand">Campaigns</BackLink>
      <PageHeader
        className="mt-3"
        title="New campaign"
        description="The campaign comes before the marketplace, so a creator is always booked against something. The brief can be one line."
      />

      <CampaignForm regions={regions} />
    </Page>
  );
}
