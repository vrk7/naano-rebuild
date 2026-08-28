import Link from "next/link";

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
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/brand"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Campaigns
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="mt-1 text-pretty text-muted-foreground">
          The campaign comes before the marketplace, so a creator is always booked
          against something. The brief can be one line.
        </p>
      </header>

      <CampaignForm regions={regions} />
    </main>
  );
}
