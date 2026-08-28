import "server-only";

import { fixtureFor } from "./fixtures";
import { readWebsite } from "./fetch-website";
import { modelProvider } from "./model";
import { parseWebsiteUrl } from "./website";
import { ok, type ParseResult } from "@/lib/parse";
import type { GenerationResult, Vocabulary } from "./intelligence";

/**
 * The address the setup form will accept.
 *
 * A demo domain is answered for rather than fetched, so it skips the checks
 * that exist to make fetching safe — `atira.example` is a reserved name that
 * resolves nowhere, which is exactly what a demo domain should be and exactly
 * what `parseWebsiteUrl` refuses. Everything else has to be a public website.
 */
export function acceptWebsite(raw: unknown): ParseResult<string> {
  if (typeof raw === "string") {
    const fixture = fixtureFor(raw);
    if (fixture) return ok(fixture.website);
  }
  return parseWebsiteUrl(raw);
}

/**
 * Website in, brand profile and three ICPs out (PRODUCT.md step 2).
 *
 * The order matters. Fixtures are consulted before the URL is validated,
 * because a demo domain is a name we answer for rather than a site we fetch —
 * `atira.example` is reserved and resolves nowhere, which is exactly what a
 * demo domain should be.
 *
 * Nothing here falls back to invented data. Every failure comes back as its own
 * reason and the brand lands in the ICP editor with it on screen, which is the
 * step PRODUCT.md says cannot be skipped anyway.
 */
export async function generateBrandIntelligence(
  rawUrl: string,
  vocabulary: Vocabulary,
): Promise<GenerationResult> {
  const fixture = fixtureFor(rawUrl);
  if (fixture) return { kind: "ok", intelligence: fixture.intelligence, source: "fixture" };

  const url = parseWebsiteUrl(rawUrl);
  if (url.kind === "invalid") return { kind: "unavailable", reason: url.error };

  const page = await readWebsite(url.value);
  if (page.kind === "unavailable") return page;

  return modelProvider.generate({ website: page.url, text: page.text }, vocabulary);
}

export { modelProvider };
