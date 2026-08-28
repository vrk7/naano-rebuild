import Link from "next/link";

import { BackLink } from "@/components/ui/page";
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
      <BackLink href={REGISTER_PATH}>Not a brand?</BackLink>

      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.014em]">Create a brand account</h1>
      <p className="text-md mt-1.5 max-w-prose text-pretty text-muted-foreground">
        Next you will paste your website, confirm the ICPs we generate from it, and
        start a campaign.
      </p>

      <BrandForm returnTo={returnTo} />
    </div>
  );
}
