import { redirect } from "next/navigation";

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
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Step 1 of 2
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your website</h1>
      <p className="mt-2 text-pretty text-muted-foreground">
        Everything the marketplace scores against comes from here. We read the page,
        write down what you sell and to whom, and you correct it on the next screen.
      </p>

      <SetupForm demoDomain={FIXTURE_DOMAINS[0]} />
    </main>
  );
}
