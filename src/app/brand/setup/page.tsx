import { redirect } from "next/navigation";

import { Page, PageHeader } from "@/components/ui/page";

import { FIXTURE_DOMAINS } from "@/lib/brand/fixtures";
import { loadWorkspace } from "@/lib/brand/queries";

import { SetupForm } from "./setup-form";

export const metadata = { title: "Your website" };

/**
 * Step one of two (PRODUCT.md step 2).
 *
 * The brand account exists; the workspace does not. This is the screen that
 * creates it, which is why every other brand screen sends you here when you
 * have no workspace rather than rendering an empty version of itself.
 */
export default async function BrandSetupPage() {
  // Onboarding is not a screen you can visit twice: the workspace is already
  // there and `create_brand_workspace` would refuse a second one.
  if (await loadWorkspace()) redirect("/brand");

  return (
    <Page width="narrow" className="py-16">
      <p className="eyebrow">Step 1 of 2</p>
      <PageHeader
        className="mt-2"
        title="Your website"
        description="Everything the marketplace scores against comes from here. We read the page, write down what you sell and to whom, and you correct it on the next screen."
      />

      <SetupForm demoDomain={FIXTURE_DOMAINS[0]} />
    </Page>
  );
}
