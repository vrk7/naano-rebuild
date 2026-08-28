/**
 * The engagement sampler — SCOPE.md's `EngagementSource` seam.
 *
 * "It takes a post and returns engagements with person and company attached.
 * Nothing above it knows the difference." A real LinkedIn scraper implements
 * this same shape later; this implementation generates instead.
 *
 * The one rule that makes the simulation worth anything: people are drawn from
 * the creator's own audience snapshot, not from a global pool. If a creator's
 * audience is 43% India then ~43% of their engagers are in India, and their ICP
 * match rate comes out low on its own without being rigged to make the point.
 * The sampler is downstream of the same data the score reads.
 */

import { createRng, hashSeed, randomInt, type Share } from "./random.ts";

export type Dimension = "job_function" | "seniority" | "industry" | "geo";

export type AudienceDistribution = Readonly<Record<Dimension, ReadonlyArray<Share>>>;

export type EngagementKind = "reaction" | "comment" | "repost";

export type GeneratedPerson = {
  readonly key: string;
  readonly fullName: string;
  readonly roleTitle: string;
  readonly headline: string;
  readonly seniority: string;
  readonly jobFunction: string;
  readonly geo: string;
  readonly industryTopicId: string;
  readonly companyKey: string;
};

export type GeneratedEngagement = {
  readonly person: GeneratedPerson;
  readonly kind: EngagementKind;
  readonly occurredAt: Date;
};

/** The seam. A scraper-backed implementation returns the same shape. */
export type EngagementSource = {
  engagementsFor(input: PostContext): GeneratedEngagement[];
};

export type PostContext = {
  /** Anything stable and unique to this post; keeps the draw reproducible. */
  readonly seed: string;
  readonly followers: number;
  readonly publishedAt: Date;
  readonly audience: AudienceDistribution;
};

// --- Shape of a post's engagement -------------------------------------------
//
// None of these are measured. They are chosen to make the post page legible and
// are the first thing to replace with real numbers if any ever arrive.

/** Engaged share of a follower base, drawn per post. */
const ENGAGEMENT_RATE_MIN = 0.004;
const ENGAGEMENT_RATE_MAX = 0.014;

/**
 * Hard cap per post. The 300k-follower creators would otherwise generate
 * thousands of rows and dominate the seed's runtime; the point they exist to
 * make — high reach, near-zero ICP match — survives being capped.
 */
const MAX_ENGAGEMENTS = 300;
const MIN_ENGAGEMENTS = 12;

/** SCOPE.md: engagement arrives "over ~5 days". */
const WINDOW_DAYS = 5;

/** Reactions dominate, comments are rarer, reposts rarest. */
const KIND_WEIGHTS: ReadonlyArray<readonly [EngagementKind, number]> = [
  ["reaction", 0.82],
  ["comment", 0.13],
  ["repost", 0.05],
];

/** Chance an engager is someone who already engaged with an earlier post. */
const REPEAT_ENGAGER_RATE = 0.18;

/** Distinct companies generated per (industry, country) pair. */
const COMPANIES_PER_SEGMENT = 6;

const FIRST_NAMES = [
  "Aaron", "Beatriz", "Chen", "Divya", "Emil", "Fatima", "Gustav", "Hannah",
  "Idris", "Jana", "Kiran", "Lars", "Meera", "Noah", "Ola", "Priya",
  "Rafael", "Sanne", "Tobias", "Ume", "Vera", "Wei", "Xavier", "Yara",
  "Zoltan", "Amara", "Bruno", "Clara", "Dmitry", "Esther", "Frank", "Gina",
  "Hugo", "Iris", "Jonas", "Kaito", "Lena", "Marco", "Nina", "Otto",
];

const LAST_NAMES = [
  "Adeyemi", "Bergman", "Castellanos", "Dietrich", "Espinoza", "Feldman",
  "Gruber", "Halvorsen", "Ibrahim", "Jansson", "Kaur", "Lindholm", "Marchetti",
  "Nowak", "Oyelaran", "Petrov", "Quesada", "Rahman", "Sandoval", "Thomsen",
  "Ustinov", "Vermeulen", "Wojcik", "Xiao", "Yamamoto", "Zimmermann",
  "Andersson", "Bianchi", "Cabrera", "Delacroix", "Engel", "Fontaine",
  "Grimaldi", "Hoekstra", "Ivanova", "Jelinek", "Kowalczyk", "Laurent",
  "Muller", "Novotny",
];

const SENIORITY_TITLES: Readonly<Record<string, string>> = {
  ic: "",
  senior: "Senior ",
  lead: "Lead ",
  manager: "Manager, ",
  director: "Director of ",
  vp: "VP of ",
  "c-level": "Head of ",
  founder: "Founder, ",
};

const FUNCTION_TITLES: Readonly<Record<string, string>> = {
  engineering: "Engineering",
  sales: "Sales",
  marketing: "Marketing",
  product: "Product",
  design: "Design",
  data: "Data",
  operations: "Operations",
  finance: "Finance",
  hr: "People",
  "legal-function": "Legal",
  "customer-success": "Customer Success",
  executive: "Business",
};

/** Picks a value in proportion to its share. */
function draw(rng: () => number, shares: ReadonlyArray<Share>): string {
  const roll = rng();
  let cumulative = 0;
  for (const entry of shares) {
    cumulative += entry.share;
    if (roll <= cumulative) return entry.value;
  }
  // Reached only through float drift at the very top of the range.
  return shares[shares.length - 1].value;
}

function drawKind(rng: () => number): EngagementKind {
  const roll = rng();
  let cumulative = 0;
  for (const [kind, weight] of KIND_WEIGHTS) {
    cumulative += weight;
    if (roll <= cumulative) return kind;
  }
  return "reaction";
}

function titleFor(seniority: string, jobFunction: string): string {
  const prefix = SENIORITY_TITLES[seniority] ?? "";
  const subject = FUNCTION_TITLES[jobFunction] ?? "Operations";
  return prefix === "" ? `${subject} Specialist` : `${prefix}${subject}`.trim();
}

/**
 * People who have already engaged with something in this workspace.
 *
 * Carried across posts so the same person can turn up on two of them, which is
 * what makes the leads table — "the same data aggregated across every post" —
 * more than a union of disjoint sets.
 */
export class PersonPool {
  private readonly people: GeneratedPerson[] = [];
  private counter = 0;

  get all(): ReadonlyArray<GeneratedPerson> {
    return this.people;
  }

  /** An existing person matching this segment, if the pool holds one. */
  private findRepeat(
    rng: () => number,
    geo: string,
    industryTopicId: string,
  ): GeneratedPerson | undefined {
    const candidates = this.people.filter(
      (p) => p.geo === geo && p.industryTopicId === industryTopicId,
    );
    if (candidates.length === 0) return undefined;
    return candidates[Math.floor(rng() * candidates.length)];
  }

  draw(
    rng: () => number,
    audience: AudienceDistribution,
  ): GeneratedPerson {
    const geo = draw(rng, audience.geo);
    const industryTopicId = draw(rng, audience.industry);

    if (rng() < REPEAT_ENGAGER_RATE) {
      const repeat = this.findRepeat(rng, geo, industryTopicId);
      if (repeat) return repeat;
    }

    const jobFunction = draw(rng, audience.job_function);
    const seniority = draw(rng, audience.seniority);

    const index = this.counter;
    this.counter += 1;

    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
    const roleTitle = titleFor(seniority, jobFunction);
    const companySlot = randomInt(rng, 1, COMPANIES_PER_SEGMENT);

    const person: GeneratedPerson = {
      key: `p-${index}`,
      fullName: `${first} ${last}`,
      roleTitle,
      headline: `${roleTitle} · ${geo}`,
      seniority,
      jobFunction,
      geo,
      industryTopicId,
      // Several people land on the same company, so the post page can roll
      // engagers up by employer.
      companyKey: `${industryTopicId}:${geo}:${companySlot}`,
    };

    this.people.push(person);
    return person;
  }
}

/**
 * Draws one post's worth of engagement from the creator's audience.
 *
 * Deterministic in `seed`, so re-running the demo seed reproduces the same
 * people on the same posts.
 */
export function createSeedEngagementSource(pool: PersonPool): EngagementSource {
  return {
    engagementsFor(input: PostContext): GeneratedEngagement[] {
      const rng = createRng(hashSeed(input.seed));

      const rate =
        ENGAGEMENT_RATE_MIN + rng() * (ENGAGEMENT_RATE_MAX - ENGAGEMENT_RATE_MIN);
      const count = Math.max(
        MIN_ENGAGEMENTS,
        Math.min(MAX_ENGAGEMENTS, Math.round(input.followers * rate)),
      );

      const engagements: GeneratedEngagement[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < count; i += 1) {
        const person = pool.draw(rng, input.audience);
        const kind = drawKind(rng);

        // engagement is unique on (post, person, kind); a repeat engager
        // reacting twice the same way is one row, not an error.
        const dedupeKey = `${person.key}:${kind}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        // Front-loaded: most engagement lands in the first day or so.
        const offsetDays = Math.pow(rng(), 2) * WINDOW_DAYS;
        const occurredAt = new Date(
          input.publishedAt.getTime() + offsetDays * 24 * 60 * 60 * 1000,
        );

        engagements.push({ person, kind, occurredAt });
      }

      return engagements;
    },
  };
}
