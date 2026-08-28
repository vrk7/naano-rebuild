/**
 * The seeded demo workspace.
 *
 * SCOPE.md: "naano's single worst property is that every surface is empty on
 * arrival. Arriving at a populated product is a feature." This is that
 * population — a brand, its ICPs, two campaigns, and five collaborations that
 * have already run all the way to published with leads on them.
 *
 * The brand is modelled on the one PRODUCT.md uses as its worked example: sells
 * to sales engineering managers at industrial equipment manufacturers. The
 * bookings are chosen so the post page has both a good outcome and a bad one to
 * show, because a demo where every post worked proves nothing.
 */

export type IcpSeed = {
  readonly rank: number;
  readonly label: string;
  readonly description: string;
  readonly targets: {
    readonly job_function: ReadonlyArray<string>;
    readonly seniority: ReadonlyArray<string>;
    /** Topic slugs; the runner resolves them to ids. */
    readonly industry: ReadonlyArray<string>;
    readonly geo: ReadonlyArray<string>;
  };
};

export type CampaignSeed = {
  readonly key: string;
  readonly name: string;
  readonly objective: string;
  readonly geos: ReadonlyArray<string>;
  readonly brief: {
    readonly mode: "specific" | "creative_freedom";
    readonly body: string;
    readonly requirements: Record<string, unknown>;
  };
};

export type BookingSeed = {
  readonly campaignKey: string;
  /** Which archetype to book, and which creator within it. */
  readonly archetype: string;
  readonly nth: number;
  readonly publishedDaysAgo: number;
  readonly postBody: string;
  readonly note: string;
};

export const DEMO_WORKSPACE = {
  name: "Atira Industrial",
  website: "https://atira.example",
  brand: {
    companyName: "Atira Industrial",
    tagline: "RFQ turnaround for industrial manufacturers",
    valueProp:
      "Atira cuts quote turnaround for industrial equipment manufacturers from days to hours, so sales engineering teams stop losing deals to slow paperwork.",
    industrySlug: "industrial-equipment",
    sizeBand: "51-200",
  },
  walletBalanceCents: 2_500_000,
} as const;

export const DEMO_ICPS: ReadonlyArray<IcpSeed> = [
  {
    rank: 1,
    label: "Sales engineering leaders, EU manufacturing",
    description:
      "The people who own quote turnaround at mid-size industrial manufacturers in Western Europe. They feel the pain directly and can authorise a pilot.",
    targets: {
      job_function: ["sales", "engineering"],
      seniority: ["manager", "director", "vp"],
      industry: ["industrial-equipment", "manufacturing"],
      geo: ["DE", "NL", "SE", "PL", "FR", "IT"],
    },
  },
  {
    rank: 2,
    label: "Supply chain and operations directors, EU",
    description:
      "Adjacent buyers. They do not own the quote itself but they own the delay it causes downstream, and they escalate.",
    targets: {
      job_function: ["operations"],
      seniority: ["director", "vp", "c-level"],
      industry: ["logistics", "supply-chain", "manufacturing"],
      geo: ["DE", "NL", "GB", "PL", "SE"],
    },
  },
  {
    rank: 3,
    label: "Automotive tier-one engineering managers",
    description:
      "A narrower segment with the same problem and a longer sales cycle. Kept active to see whether the content reaches them at all.",
    targets: {
      job_function: ["engineering", "operations"],
      seniority: ["manager", "lead"],
      industry: ["automotive", "industrial-equipment"],
      geo: ["DE", "FR", "IT", "PL"],
    },
  },
];

export const DEMO_CAMPAIGNS: ReadonlyArray<CampaignSeed> = [
  {
    key: "dach-manufacturing",
    name: "EU manufacturing — RFQ turnaround",
    objective:
      "Reach sales engineering leaders at industrial manufacturers and put quote turnaround on their agenda.",
    geos: ["DE", "NL", "SE", "PL", "FR"],
    brief: {
      mode: "specific",
      body: "Talk about what a slow quote actually costs an industrial manufacturer — the deal that goes quiet, not the admin hours. Mention Atira once, in your own words, and link to the RFQ teardown.",
      requirements: {
        must_mention: ["Atira", "RFQ turnaround"],
        must_include_link: true,
        banned_claims: ["guaranteed", "fastest in the world", "10x"],
        length: { min: 400, max: 1800 },
        requires_disclosure: true,
      },
    },
  },
  {
    key: "supply-chain-pov",
    name: "Supply chain point of view",
    objective:
      "Broader reach into operations and supply chain leadership. Looser brief, on purpose.",
    geos: ["DE", "NL", "GB", "PL"],
    brief: {
      mode: "creative_freedom",
      body: "Your take on where quoting breaks down in industrial supply chains. However you want to tell it.",
      // creative_freedom means {} and every deterministic check passes
      // vacuously (PRODUCT.md, "Campaign and brief").
      requirements: {},
    },
  },
];

/**
 * Five published collaborations.
 *
 * The mix is the point. Two strong industrial creators, one logistics creator,
 * one deep-but-small engineering creator, and one from the global-reach-trap
 * archetype — 300k+ followers, a cheap rate, and an audience that matches this
 * brand's ICPs on almost nothing. On the post page that last one should show a
 * large engaged-person count next to a near-zero ICP-matched count, and the
 * worst cost per ICP-matched person of the five.
 */
export const DEMO_BOOKINGS: ReadonlyArray<BookingSeed> = [
  {
    campaignKey: "dach-manufacturing",
    archetype: "eu-industrial",
    nth: 0,
    publishedDaysAgo: 34,
    postBody:
      "A quote that takes four days does not lose you four days. It loses you the deal, because by day three the buyer has already been given a number by someone else.\n\nI spent a decade in sales engineering at a mid-size manufacturer. The bottleneck was never the engineering. It was the eleven-step approval path between the engineer who knew the answer and the PDF that went out.\n\nWe have been looking at what Atira does to RFQ turnaround here. Full teardown in the comments.\n\n#paid",
    note: "Strong fit. Audience is exactly the ICP.",
  },
  {
    campaignKey: "dach-manufacturing",
    archetype: "eu-industrial",
    nth: 3,
    publishedDaysAgo: 21,
    postBody:
      "Nobody in industrial sales complains about RFQ turnaround, because everybody assumes it is just how it is.\n\nIt is not. I pulled the numbers on our last 200 quotes and the median time from request to sent was 61 hours. Of that, 4 hours was work.\n\nAtira is the first thing I have seen aimed squarely at the other 57. Teardown linked below.\n\n#paid",
    note: "Strong fit, second creator on the same campaign.",
  },
  {
    campaignKey: "supply-chain-pov",
    archetype: "logistics-supply",
    nth: 1,
    publishedDaysAgo: 27,
    postBody:
      "Everyone models supply chain risk as a shipping problem. In my experience the delay starts much earlier, in the quote.\n\nIf it takes your supplier three days to price a change, every downstream buffer you built is already spent before the first container moves.\n\nWorth reading Atira's RFQ turnaround teardown if this is your world.\n\n#paid",
    note: "Adjacent audience. Should match ICP 2 more than ICP 1.",
  },
  {
    campaignKey: "supply-chain-pov",
    archetype: "niche-engineering",
    nth: 2,
    publishedDaysAgo: 13,
    postBody:
      "Small audience, narrow topic, so this will not be for most of you.\n\nIf you build configurable industrial equipment, your quoting system is a compiler. It takes a spec and emits a price. And like every compiler nobody owns, it has been accumulating special cases for fifteen years.\n\nAtira's RFQ teardown is the first writeup I have seen that treats it that way.\n\n#paid",
    note: "Small but precise. Few engagements, high match rate.",
  },
  {
    campaignKey: "supply-chain-pov",
    archetype: "global-reach-trap",
    nth: 0,
    publishedDaysAgo: 8,
    postBody:
      "Most businesses lose money for one reason: they are too slow to answer.\n\nSlow quote, slow reply, slow follow-up. Speed is the whole game.\n\nHere is a tool doing it for industrial manufacturers. Check Atira out.\n\n#paid #ad",
    note: "The trap. Huge reach, cheap, and almost no ICP match.",
  },
];
