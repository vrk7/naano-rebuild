/**
 * Deterministic creator generation from the archetypes.
 *
 * Industry facets carry a topic *slug*, not a topic id — ids are assigned by
 * the database. The runner resolves slugs to ids on insert, which is the only
 * place the two representations meet.
 */

import { ARCHETYPES, type Archetype, type Dimension } from "./archetypes.ts";
import {
  buildDistribution,
  createRng,
  decayingWeights,
  hashSeed,
  randomInt,
  sample,
  type Share,
} from "./random.ts";

const FIRST_NAMES = [
  "Anika", "Bastian", "Camille", "Diego", "Elif", "Felix", "Greta", "Hassan",
  "Ingrid", "Jonas", "Karin", "Lukas", "Marta", "Niels", "Olga", "Pieter",
  "Quentin", "Rania", "Sofia", "Tomas", "Ursula", "Viktor", "Wanda", "Yusuf",
  "Zara", "Adaeze", "Bilal", "Chiara", "Dmitri", "Emeka", "Farida", "Gabriel",
  "Hina", "Ivan", "Joanna", "Kwame", "Laila", "Mateo", "Nadia", "Omar",
];

const LAST_NAMES = [
  "Achterberg", "Bauer", "Costa", "Dubois", "Ekstrom", "Fischer", "Grabowski",
  "Haddad", "Iversen", "Jansen", "Kowalski", "Lindqvist", "Moreau", "Novak",
  "Okafor", "Patel", "Quintero", "Rossi", "Silva", "Tanaka", "Ubeda",
  "Voss", "Wagner", "Xu", "Yilmaz", "Zielinski", "Almeida", "Brandt",
  "Cunha", "Duarte", "Eriksen", "Farrell", "Gallagher", "Hoffmann", "Ito",
  "Jimenez", "Klein", "Larsen", "Mahmood", "Nilsson",
];

export type SeededFacet = {
  readonly dimension: "job_function" | "seniority" | "industry" | "geo";
  /** Topic slug when dimension is "industry", otherwise the literal value. */
  readonly value: string;
  readonly share: number;
};

export type SeededCreator = {
  readonly archetype: string;
  readonly displayName: string;
  readonly headline: string;
  readonly country: string;
  readonly linkedinUrl: string;
  readonly followers: number;
  readonly topicSlugs: ReadonlyArray<string>;
  readonly priceCents: number;
  readonly sampleSize: number;
  readonly postsAnalyzed: number;
  readonly facets: ReadonlyArray<SeededFacet>;
};

/** Per-creator spread around an archetype's shape. */
const JITTER_MIN = 0.6;
const JITTER_RANGE = 0.8;
const CONCENTRATION_SPREAD = 0.12;

/**
 * Every creator gets its own audience, not its archetype's audience.
 *
 * Without this the eight creators sharing an archetype score within a point of
 * each other and the marketplace reads as nine clusters rather than a
 * population — the "simulation is too clean" failure SCOPE.md lists as one of
 * the things that would sink the build. Explicit weights are jittered too, or
 * the archetypes that pin exact shares produce identical creators.
 */
function distributionFor(rng: () => number, dimension: Dimension): Share[] {
  const jitter = () => JITTER_MIN + rng() * JITTER_RANGE;

  if (dimension.weights) {
    return buildDistribution(
      dimension.values,
      dimension.weights.map((w) => w * jitter()),
    );
  }

  const base = dimension.concentration ?? 0.6;
  const spread = (rng() - 0.5) * 2 * CONCENTRATION_SPREAD;
  const concentration = Math.min(0.95, Math.max(0.2, base + spread));
  return buildDistribution(
    dimension.values,
    decayingWeights(rng, dimension.values.length, concentration),
  );
}

/**
 * Coprime with FIRST_NAMES.length * LAST_NAMES.length so the walk is a
 * bijection. Deliberately not 41: a stride of one list-length plus one advances
 * both indices in lockstep and pairs every creator with a matching initial
 * ("Anika Achterberg", "Bastian Bauer").
 */
const NAME_STRIDE = 397;

/**
 * Picks a distinct first/last pair per creator.
 *
 * Walking both lists by the same index repeats after 40 creators, and stepping
 * the surname by index alone groups every archetype block under one surname —
 * 18 consecutive "Achterberg"s reads as generated data at a glance. Striding
 * through the full grid of combinations by a coprime factor keeps consecutive
 * creators unrelated and stays collision-free up to 1600 of them.
 */
function nameFor(index: number): string {
  const combinations = FIRST_NAMES.length * LAST_NAMES.length;
  const slot = (index * NAME_STRIDE) % combinations;
  const first = FIRST_NAMES[slot % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(slot / FIRST_NAMES.length)];
  return `${first} ${last}`;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function facetsFor(rng: () => number, archetype: Archetype): SeededFacet[] {
  const dimensions = [
    ["job_function", archetype.jobFunction],
    ["seniority", archetype.seniority],
    ["industry", archetype.industry],
    ["geo", archetype.geo],
  ] as const;

  return dimensions.flatMap(([dimension, spec]) =>
    distributionFor(rng, spec)
      // A zero share is noise in a breakdown table, not information.
      .filter((entry) => entry.share > 0)
      .map((entry) => ({ dimension, value: entry.value, share: entry.share })),
  );
}

function buildCreator(archetype: Archetype, index: number): SeededCreator {
  const displayName = nameFor(index);
  // Seeded from the name so a creator's audience is stable across runs even if
  // the archetype counts change.
  const rng = createRng(hashSeed(`${archetype.key}:${displayName}:${index}`));

  return {
    archetype: archetype.key,
    displayName,
    headline: archetype.headline,
    country: archetype.countries[index % archetype.countries.length],
    linkedinUrl: `https://www.linkedin.com/in/${slugify(displayName)}-${index}`,
    followers: randomInt(rng, archetype.followers[0], archetype.followers[1]),
    // PRODUCT.md caps creator_topic at 3, and the schema enforces it.
    topicSlugs: sample(rng, archetype.industry.values, 3),
    priceCents: randomInt(rng, archetype.rateCents[0], archetype.rateCents[1]),
    sampleSize: randomInt(rng, archetype.sampleSize[0], archetype.sampleSize[1]),
    postsAnalyzed: randomInt(rng, archetype.postsAnalyzed[0], archetype.postsAnalyzed[1]),
    facets: facetsFor(rng, archetype),
  };
}

export function generateCreators(): SeededCreator[] {
  const creators: SeededCreator[] = [];
  let index = 0;

  for (const archetype of ARCHETYPES) {
    for (let i = 0; i < archetype.count; i += 1) {
      creators.push(buildCreator(archetype, index));
      index += 1;
    }
  }

  return creators;
}
