/**
 * Deterministic randomness for the seed.
 *
 * SCOPE.md makes the seed "the fixture everything else is tested against", so
 * it has to produce the same workspace every run. Every draw goes through a
 * seeded PRNG; nothing calls Math.random.
 */

/** mulberry32 — small, fast, and stable across Node versions. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash, so a name maps to the same seed every run. */
export function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: () => number, items: ReadonlyArray<T>): T {
  return items[Math.floor(rng() * items.length)];
}

/** Fisher-Yates on a copy — the input array is never mutated. */
export function shuffle<T>(rng: () => number, items: ReadonlyArray<T>): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sample<T>(rng: () => number, items: ReadonlyArray<T>, count: number): T[] {
  return shuffle(rng, items).slice(0, Math.min(count, items.length));
}

export type Share = { readonly value: string; readonly share: number };

const BASIS_POINTS = 10_000;

/**
 * Builds a distribution over `values` that sums to exactly 1.
 *
 * Shares are allocated in basis points and the rounding remainder is given to
 * the largest bucket, because audience_facet.share is numeric(5,4) and
 * PRODUCT.md requires the rows to sum to 1.0 within a dimension. Floating point
 * addition of four-decimal shares does not reliably land on 1.
 *
 * `weights` are relative; they are normalised here.
 */
export function buildDistribution(
  values: ReadonlyArray<string>,
  weights: ReadonlyArray<number>,
): Share[] {
  if (values.length === 0) return [];
  if (values.length !== weights.length) {
    throw new Error(
      `buildDistribution: ${values.length} values but ${weights.length} weights`,
    );
  }

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) throw new Error("buildDistribution: weights must sum above zero");

  const points = weights.map((w) => Math.floor((w / total) * BASIS_POINTS));
  const allocated = points.reduce((sum, p) => sum + p, 0);

  let largest = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i] > points[largest]) largest = i;
  }

  const balanced = points.map((p, i) =>
    i === largest ? p + (BASIS_POINTS - allocated) : p,
  );

  return values.map((value, i) => ({
    value,
    share: balanced[i] / BASIS_POINTS,
  }));
}

/**
 * Random relative weights with a decay factor, so the first value dominates.
 * A concentration near 1 gives a flat audience, near 0 a very focused one.
 */
export function decayingWeights(
  rng: () => number,
  count: number,
  concentration: number,
): number[] {
  const weights: number[] = [];
  let current = 1;
  for (let i = 0; i < count; i += 1) {
    weights.push(current * (0.75 + rng() * 0.5));
    current *= concentration;
  }
  return weights;
}
