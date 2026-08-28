import Link from "next/link";

import { LOGIN_PATH, RETURN_TO_PARAM, safeReturnTo, type Role } from "@/lib/auth/roles";

export const metadata = { title: "Create your account" };

const ROLE_COPY: Readonly<Record<Role, { label: string; hint: string }>> = {
  creator: {
    label: "I'm a creator",
    hint: "Get paid to post on LinkedIn for B2B brands you actually use.",
  },
  brand: {
    label: "I'm a brand",
    hint: "Find creators, launch campaigns, and trace real pipeline back to each post.",
  },
};

/**
 * The order the two answers are offered in. Creator first, matching naano
 * (`recon/brand/01`): the side with less to gain from being here goes first.
 */
const PICKER_ORDER = ["creator", "brand"] as const;

/**
 * Fails the build if a role is ever added and not offered by the picker. A
 * front door that silently stops mentioning one side of a two-sided product is
 * the mistake this screen exists to undo, so it is caught by the compiler
 * rather than by noticing.
 */
type EveryRoleIsOffered =
  Exclude<Role, (typeof PICKER_ORDER)[number]> extends never ? true : never;
const _everyRoleIsOffered: EveryRoleIsOffered = true;
void _everyRoleIsOffered;

/**
 * The role picker.
 *
 * One screen, two answers, then a branch — the front door of a two-sided
 * product. It asks the question before collecting anything, because the answer
 * changes what the next screen is for, and burying it in a radio group on a
 * signup form makes the second side of the product look like a setting.
 *
 * Creator is listed first, matching naano (`recon/brand/01`). The side with
 * less to gain from being here goes first.
 */
export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  const raw = params[RETURN_TO_PARAM];
  const returnTo = safeReturnTo(typeof raw === "string" ? raw : null);
  const suffix = returnTo ? `?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}` : "";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.014em]">Create your account</h1>
      <p className="text-md mt-1.5 text-muted-foreground">First, who are you here as?</p>

      <div className="mt-6 space-y-2">
        {PICKER_ORDER.map((role) => (
          <Link
            key={role}
            href={`/register/${role}${suffix}`}
            className="block rounded-lg border border-border p-4 transition-colors outline-none hover:border-brand/40 hover:bg-brand-soft focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <span className="text-md block font-medium">{ROLE_COPY[role].label}</span>
            <span className="mt-0.5 block text-sm text-pretty text-muted-foreground">
              {ROLE_COPY[role].hint}
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`${LOGIN_PATH}${suffix}`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
