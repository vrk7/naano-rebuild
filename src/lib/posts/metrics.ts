/**
 * Post economics and rollups.
 *
 * Pure functions over already-loaded rows. This is the "budget and projection
 * math" CLAUDE.md requires tests for, so nothing here touches the database.
 *
 * Everything stays in integer cents until it is formatted. Dividing a price
 * into dollars first and multiplying back loses fractions of a cent per person
 * and the totals stop reconciling.
 */

import { ICP_MATCH_THRESHOLD } from "@/lib/score/weights";

export type PersonMatch = {
  readonly icpId: string;
  readonly icpLabel: string;
  readonly icpRank: number;
  readonly score: number;
};

export type EngagedPerson = {
  readonly id: string;
  readonly fullName: string;
  readonly roleTitle: string | null;
  readonly seniority: string | null;
  readonly companyId: string | null;
  readonly companyName: string | null;
  readonly companyCountry: string | null;
  /** Every ICP this person scored against, best first. */
  readonly matches: ReadonlyArray<PersonMatch>;
  readonly engagementKinds: ReadonlyArray<string>;
};

/**
 * A person counts as matched when their best ICP score clears the threshold.
 * Below it they are still a lead and still listed — they are just not one this
 * brand's ICPs asked for.
 */
export function isMatched(person: EngagedPerson): boolean {
  return bestScore(person) >= ICP_MATCH_THRESHOLD;
}

export function bestScore(person: EngagedPerson): number {
  return person.matches.length === 0 ? 0 : person.matches[0].score;
}

export type PostEconomics = {
  readonly costCents: number;
  readonly engagedPeople: number;
  readonly matchedPeople: number;
  /** Null when there is nobody to divide by — never zero, which would read as free. */
  readonly costPerEngagedCents: number | null;
  readonly costPerMatchedCents: number | null;
  readonly matchRate: number | null;
};

/**
 * Cost per engaged person and cost per ICP-matched person.
 *
 * The second is the number the whole product exists to show, and the case that
 * matters most is the one where it does not exist: a post that reached hundreds
 * of people and matched none of them has no cost per matched person. That is
 * reported as null and rendered as an em dash, not as zero and not as the cost
 * itself. Zero would read as free, which is the opposite of true.
 */
export function postEconomics(
  costCents: number,
  people: ReadonlyArray<EngagedPerson>,
): PostEconomics {
  const engagedPeople = people.length;
  const matchedPeople = people.filter(isMatched).length;

  return {
    costCents,
    engagedPeople,
    matchedPeople,
    costPerEngagedCents: engagedPeople > 0 ? Math.round(costCents / engagedPeople) : null,
    costPerMatchedCents: matchedPeople > 0 ? Math.round(costCents / matchedPeople) : null,
    matchRate: engagedPeople > 0 ? matchedPeople / engagedPeople : null,
  };
}

export type CompanyRollup = {
  readonly id: string;
  readonly name: string;
  readonly country: string | null;
  readonly engaged: number;
  readonly matched: number;
};

/**
 * Companies rolled up from the people who engaged.
 *
 * Sorted by matched first, then engaged, so the employers this brand actually
 * sells to lead regardless of which one sent the most bodies. People with no
 * resolved company are dropped rather than bucketed into an "Unknown" row that
 * would then sort as if it were a real account.
 */
export function rollUpCompanies(
  people: ReadonlyArray<EngagedPerson>,
): CompanyRollup[] {
  const byCompany = new Map<string, CompanyRollup>();

  for (const person of people) {
    if (!person.companyId || !person.companyName) continue;

    const existing = byCompany.get(person.companyId);
    const matched = isMatched(person) ? 1 : 0;

    byCompany.set(person.companyId, {
      id: person.companyId,
      name: person.companyName,
      country: person.companyCountry,
      engaged: (existing?.engaged ?? 0) + 1,
      matched: (existing?.matched ?? 0) + matched,
    });
  }

  return [...byCompany.values()].sort(
    (a, b) => b.matched - a.matched || b.engaged - a.engaged || a.name.localeCompare(b.name),
  );
}

/** Best match first, then by name, so the table has a stable order. */
export function sortByRelevance(
  people: ReadonlyArray<EngagedPerson>,
): EngagedPerson[] {
  return [...people].sort(
    (a, b) => bestScore(b) - bestScore(a) || a.fullName.localeCompare(b.fullName),
  );
}

export function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${Math.round(ratio * 100)}%`;
}
