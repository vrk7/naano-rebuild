/**
 * Known demo domains (SCOPE.md: "a fixture for known demo domains").
 *
 * The fixture is the same data `npm run db:seed:demo` builds the demo
 * workspace from, imported rather than copied — a second Atira that drifted
 * from the seeded one would make the demo say two different things about the
 * same company.
 *
 * It is checked before the URL is validated, let alone fetched. `atira.example`
 * is a reserved name that resolves nowhere, which is exactly what a domain in a
 * demo should be, and no amount of fetching would ever read it.
 */

import { DEMO_ICPS, DEMO_WORKSPACE } from "@/lib/seed/demo";
import type { BrandIntelligence } from "./intelligence";

const ATIRA: BrandIntelligence = {
  profile: {
    companyName: DEMO_WORKSPACE.brand.companyName,
    tagline: DEMO_WORKSPACE.brand.tagline,
    valueProp: DEMO_WORKSPACE.brand.valueProp,
    industry: DEMO_WORKSPACE.brand.industrySlug,
    sizeBand: DEMO_WORKSPACE.brand.sizeBand,
  },
  icps: DEMO_ICPS.map((icp) => ({
    label: icp.label,
    description: icp.description,
    targets: {
      job_function: icp.targets.job_function,
      seniority: icp.targets.seniority,
      industry: icp.targets.industry,
      geo: icp.targets.geo,
    },
  })),
};

const FIXTURES: Readonly<Record<string, BrandIntelligence>> = {
  "atira.example": ATIRA,
  "www.atira.example": ATIRA,
};

/**
 * The hostname of whatever was pasted, without judging it.
 *
 * Deliberately more permissive than `parseWebsiteUrl`: a fixture domain is not
 * a website we will ever fetch, so it does not have to pass the checks that
 * exist to make fetching safe.
 */
function hostnameOf(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export type Fixture = {
  /** The canonical address to store, since the pasted one may lack a scheme. */
  readonly website: string;
  readonly intelligence: BrandIntelligence;
};

export function fixtureFor(rawUrl: string): Fixture | null {
  const hostname = hostnameOf(rawUrl);
  if (!hostname) return null;

  const intelligence = FIXTURES[hostname];
  return intelligence ? { website: `https://${hostname}`, intelligence } : null;
}

/** Named on the setup screen, so a demo does not look like a live analysis. */
export const FIXTURE_DOMAINS: ReadonlyArray<string> = ["atira.example"];
