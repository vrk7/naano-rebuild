import Link from "next/link";

import { REGISTER_PATH, RETURN_TO_PARAM, safeReturnTo } from "@/lib/auth/roles";

import { BrandForm } from "./brand-form";

export const metadata = { title: "Create a brand account" };

export default async function RegisterBrandPage({
  searchParams,
}: PageProps<"/register/brand">) {
  const params = await searchParams;
  const raw = params[RETURN_TO_PARAM];
  const returnTo = safeReturnTo(typeof raw === "string" ? raw : null);

  return (
    <div>
      <Link
        href={REGISTER_PATH}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Not a brand?
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Create a brand account</h1>
      <p className="mt-2 text-pretty text-muted-foreground">
        Next you will paste your website, confirm the ICPs we generate from it, and
        start a campaign.
      </p>

      <BrandForm returnTo={returnTo} />
    </div>
  );
}
