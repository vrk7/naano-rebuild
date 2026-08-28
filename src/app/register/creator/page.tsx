import Link from "next/link";

import { REGISTER_PATH, RETURN_TO_PARAM, safeReturnTo } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

import { CreatorForm } from "./creator-form";

export const metadata = { title: "Create a creator account" };

/**
 * The industries a creator can claim.
 *
 * Read as an anonymous request — this page has no session by definition — which
 * the `topic readable by anyone` policy allows. One vocabulary, shared with ICP
 * targets and the marketplace filters, so a creator cannot pick an industry no
 * brand can filter on (PRODUCT.md, "One taxonomy").
 */
async function loadIndustries() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic")
    .select("id, label")
    .eq("kind", "industry")
    .order("label");

  if (error) throw new Error(`Could not load industries: ${error.message}`);
  if (!data || data.length === 0) {
    // An empty list would render a screen that cannot be submitted, with no
    // explanation. Better to fail where the cause is visible.
    throw new Error("No industries are configured; the taxonomy has not been seeded.");
  }

  return data as Array<{ id: string; label: string }>;
}

export default async function RegisterCreatorPage({
  searchParams,
}: PageProps<"/register/creator">) {
  const params = await searchParams;
  const raw = params[RETURN_TO_PARAM];
  const returnTo = safeReturnTo(typeof raw === "string" ? raw : null);
  const industries = await loadIndustries();

  return (
    <div>
      <Link
        href={REGISTER_PATH}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Not a creator?
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Create a creator account
      </h1>
      <p className="mt-2 text-pretty text-muted-foreground">
        One screen. Your profile URL, what you post about, and what you charge.
      </p>

      <CreatorForm industries={industries} returnTo={returnTo} />
    </div>
  );
}
