/**
 * Creator archetypes.
 *
 * SCOPE.md is explicit that the seed must contain bad matches: "If every seeded
 * creator scores 80+, the score is untested and the demo is a lie of the same
 * kind naano tells." So these deliberately span creators who fit a European
 * industrial ICP, creators who cannot, and creators we should refuse to score
 * at all for want of a sample.
 */

export type Dimension = {
  readonly values: ReadonlyArray<string>;
  /** Explicit relative weights, or omit for a decaying profile. */
  readonly weights?: ReadonlyArray<number>;
  /** Decay per position. Near 1 is a flat audience, near 0 a focused one. */
  readonly concentration?: number;
};

export type Archetype = {
  readonly key: string;
  readonly count: number;
  readonly headline: string;
  readonly countries: ReadonlyArray<string>;
  readonly geo: Dimension;
  readonly jobFunction: Dimension;
  readonly seniority: Dimension;
  readonly industry: Dimension;
  readonly followers: readonly [number, number];
  readonly rateCents: readonly [number, number];
  readonly sampleSize: readonly [number, number];
  readonly postsAnalyzed: readonly [number, number];
};

export const ARCHETYPES: ReadonlyArray<Archetype> = [
  {
    key: "eu-industrial",
    count: 18,
    headline: "Industrial automation | Manufacturing engineering",
    countries: ["DE", "NL", "SE", "PL"],
    geo: { values: ["DE", "NL", "SE", "PL", "FR", "IT", "GB"], concentration: 0.62 },
    jobFunction: { values: ["engineering", "operations", "sales", "product"], concentration: 0.55 },
    seniority: { values: ["manager", "director", "lead", "senior", "vp"], concentration: 0.7 },
    industry: { values: ["industrial-equipment", "manufacturing", "supply-chain", "automotive"], concentration: 0.6 },
    followers: [8_000, 41_000],
    rateCents: [90_000, 260_000],
    sampleSize: [420, 1_900],
    postsAnalyzed: [26, 70],
  },
  {
    key: "eu-b2b-sales",
    count: 20,
    headline: "B2B sales leadership | Pipeline and enablement",
    countries: ["GB", "IE", "NL", "FR"],
    geo: { values: ["GB", "IE", "NL", "FR", "DE", "ES", "SE"], concentration: 0.6 },
    jobFunction: { values: ["sales", "marketing", "customer-success", "executive"], concentration: 0.5 },
    seniority: { values: ["manager", "director", "vp", "senior", "c-level"], concentration: 0.72 },
    industry: { values: ["saas", "professional-services", "consulting", "fintech"], concentration: 0.62 },
    followers: [12_000, 68_000],
    rateCents: [110_000, 320_000],
    sampleSize: [500, 2_400],
    postsAnalyzed: [30, 85],
  },
  {
    key: "us-tech-exec",
    count: 22,
    headline: "Scaling engineering orgs | CTO advisor",
    countries: ["US", "CA"],
    geo: { values: ["US", "CA", "GB", "DE", "IN"], concentration: 0.45 },
    jobFunction: { values: ["engineering", "product", "executive", "data"], concentration: 0.58 },
    seniority: { values: ["director", "vp", "c-level", "lead", "senior"], concentration: 0.7 },
    industry: { values: ["saas", "cloud-infrastructure", "devtools", "ai-ml", "cybersecurity"], concentration: 0.65 },
    followers: [20_000, 140_000],
    rateCents: [180_000, 520_000],
    sampleSize: [800, 4_200],
    postsAnalyzed: [40, 120],
  },
  {
    /**
     * The trap, and the reason this seed exists. Enormous reach, a low cost per
     * follower, and an audience that matches a European industrial ICP on
     * almost nothing. Mirrors the creator naano's own marketplace put first:
     * 43% India / 24% Pakistan / 8% Nigeria, 62% founders, Marketing 26% /
     * AI 23% (PRODUCT.md, "Three failures"). Expect scores in the thirties.
     */
    key: "global-reach-trap",
    count: 8,
    headline: "Growth hacking | 6-figure founder journeys",
    countries: ["IN", "PK", "AE"],
    geo: {
      values: ["IN", "PK", "NG", "BR", "AE", "US", "GB"],
      weights: [43, 24, 8, 7, 6, 8, 4],
    },
    jobFunction: {
      values: ["marketing", "executive", "sales", "engineering"],
      weights: [38, 34, 18, 10],
    },
    seniority: {
      values: ["founder", "ic", "senior", "manager"],
      weights: [62, 18, 12, 8],
    },
    industry: {
      values: ["media", "ai-ml", "ecommerce", "saas"],
      weights: [26, 23, 29, 22],
    },
    followers: [180_000, 420_000],
    rateCents: [60_000, 140_000],
    sampleSize: [1_200, 5_000],
    postsAnalyzed: [55, 160],
  },
  {
    key: "emerging-growth",
    count: 20,
    headline: "Startup marketing | Content and community",
    countries: ["IN", "BR", "NG", "MX", "ZA"],
    geo: { values: ["IN", "BR", "NG", "MX", "ZA", "PK", "US"], concentration: 0.72 },
    jobFunction: { values: ["marketing", "sales", "product", "operations"], concentration: 0.62 },
    seniority: { values: ["ic", "senior", "founder", "manager"], concentration: 0.7 },
    industry: { values: ["ecommerce", "saas", "edtech", "media", "retail"], concentration: 0.7 },
    followers: [4_000, 32_000],
    rateCents: [25_000, 90_000],
    sampleSize: [260, 1_400],
    postsAnalyzed: [18, 55],
  },
  {
    key: "niche-engineering",
    count: 20,
    headline: "Embedded systems | Industrial IoT",
    countries: ["DE", "US", "PL", "SE"],
    geo: { values: ["DE", "US", "PL", "SE", "NL", "IN"], concentration: 0.58 },
    jobFunction: { values: ["engineering", "data", "product"], concentration: 0.35 },
    seniority: { values: ["senior", "lead", "ic", "manager"], concentration: 0.62 },
    industry: { values: ["industrial-equipment", "devtools", "manufacturing", "energy", "automotive"], concentration: 0.66 },
    followers: [2_500, 16_000],
    rateCents: [45_000, 130_000],
    sampleSize: [180, 900],
    postsAnalyzed: [14, 44],
  },
  {
    /**
     * Confidence floor. sample_size < 100 or posts_analyzed < 10 forces "low",
     * which sorts these last and shows "Not enough data" rather than a number
     * (PRODUCT.md, "Confidence, and refusing to answer").
     */
    key: "new-creator",
    count: 16,
    headline: "Building in public | Early-stage operator",
    countries: ["US", "GB", "DE", "IN", "CA"],
    geo: { values: ["US", "GB", "DE", "IN", "CA", "AU"], concentration: 0.75 },
    jobFunction: { values: ["product", "engineering", "marketing", "design"], concentration: 0.72 },
    seniority: { values: ["ic", "senior", "founder", "lead"], concentration: 0.75 },
    industry: { values: ["saas", "devtools", "ai-ml", "fintech"], concentration: 0.75 },
    followers: [600, 5_200],
    rateCents: [8_000, 40_000],
    sampleSize: [22, 96],
    postsAnalyzed: [2, 9],
  },
  {
    key: "generalist-business",
    count: 18,
    headline: "Leadership, careers and workplace culture",
    countries: ["US", "GB", "AU", "CA", "SG"],
    geo: { values: ["US", "GB", "AU", "CA", "SG", "IN", "AE", "DE"], concentration: 0.85 },
    jobFunction: { values: ["hr", "operations", "executive", "marketing", "finance"], concentration: 0.85 },
    seniority: { values: ["manager", "senior", "director", "ic", "vp"], concentration: 0.85 },
    industry: { values: ["professional-services", "consulting", "insurance", "legal", "retail"], concentration: 0.85 },
    followers: [15_000, 90_000],
    rateCents: [70_000, 210_000],
    sampleSize: [600, 2_800],
    postsAnalyzed: [35, 95],
  },
  {
    key: "logistics-supply",
    count: 18,
    headline: "Freight, logistics and supply chain resilience",
    countries: ["NL", "DE", "SG", "AE", "US"],
    geo: { values: ["NL", "DE", "SG", "AE", "US", "GB", "PL"], concentration: 0.65 },
    jobFunction: { values: ["operations", "sales", "executive", "finance"], concentration: 0.55 },
    seniority: { values: ["director", "manager", "vp", "senior"], concentration: 0.68 },
    industry: { values: ["logistics", "supply-chain", "manufacturing", "retail"], concentration: 0.6 },
    followers: [6_000, 45_000],
    rateCents: [65_000, 190_000],
    sampleSize: [340, 1_600],
    postsAnalyzed: [22, 62],
  },
];

export const TOTAL_CREATORS = ARCHETYPES.reduce((sum, a) => sum + a.count, 0);
