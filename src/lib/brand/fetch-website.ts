import "server-only";

import { lookup } from "node:dns/promises";

import { htmlToText, isIpLiteral, parseWebsiteUrl } from "./website";

/**
 * Fetching the website a brand pasted.
 *
 * This is the request that makes onboarding server-side request forgery
 * territory: a URL the user chose, fetched from our network position, on
 * infrastructure with a metadata endpoint on a private address. `website.ts`
 * refuses the names; this file refuses the addresses those names resolve to,
 * and re-checks on every redirect hop rather than letting `fetch` follow one
 * for us into a private network.
 *
 * A failure here is never fatal to onboarding. The brand lands in the ICP
 * editor with the reason on screen and fills it in themselves.
 */

/**
 * Both numbers are guesses with nothing measured behind them.
 *
 * naano tells the user its own analysis takes 20–40 seconds (`recon/brand/04`);
 * this fetch is one part of that budget, and a marketing page that has not
 * answered in eight seconds is not going to leave room for the model call.
 * A megabyte is far more HTML than any home page, and the cap is what stops a
 * pasted link to a large file holding the request open.
 */
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_000_000;

/** Enough for the usual apex → www → https shuffle, and no more. */
const MAX_REDIRECTS = 3;

export type WebsiteRead =
  | { readonly kind: "ok"; readonly url: string; readonly text: string }
  | { readonly kind: "unavailable"; readonly reason: string };

/**
 * Addresses that are ours rather than the internet's.
 *
 * Loopback, link-local (which is where cloud metadata lives), the RFC 1918
 * ranges, and carrier-grade NAT. A public hostname resolving into any of them
 * is either a misconfiguration or someone using our server as a proxy.
 */
function isPrivateAddress(address: string, family: number): boolean {
  if (family === 6) {
    const ip = address.toLowerCase();
    if (ip === "::1" || ip === "::") return true;
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(ip) || /^fe[89ab]/.test(ip)) return true;
    // ::ffff:10.0.0.1 is an IPv4 address wearing an IPv6 hat.
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
    return mapped ? isPrivateAddress(mapped[1], 4) : false;
  }

  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function resolvesPublicly(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every((entry) => !isPrivateAddress(entry.address, entry.family));
  } catch {
    // A name that does not resolve is not reachable either, and the caller
    // reports it as a site we could not read rather than as a security refusal.
    return false;
  }
}

/** Reads at most MAX_BYTES of a response body, without buffering more than that. */
async function readCapped(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(decoder.decode(value, { stream: true }));
      if (total >= MAX_BYTES) break;
    }
  } finally {
    await reader.cancel().catch(() => {
      // The body is already being abandoned; a failure to cancel it changes
      // nothing about the text we have, and there is no caller to tell.
    });
  }

  return chunks.join("");
}

/**
 * Fetches one page and returns its text.
 *
 * Redirects are followed by hand so each hop's hostname goes through the same
 * checks as the first. `fetch`'s own redirect handling would resolve and
 * connect to the next host before we ever saw it.
 */
export async function readWebsite(rawUrl: string): Promise<WebsiteRead> {
  const parsed = parseWebsiteUrl(rawUrl);
  if (parsed.kind === "invalid") return { kind: "unavailable", reason: parsed.error };

  let current = parsed.value;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = new URL(current);

    if (isIpLiteral(url.hostname) || !(await resolvesPublicly(url.hostname))) {
      return {
        kind: "unavailable",
        reason: `${url.hostname} does not resolve to a public address, so it was not read.`,
      };
    }

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // Says who is asking. A site that blocks this is entitled to.
          "user-agent": "naano-rebuild/0.1 (+brand onboarding)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { kind: "unavailable", reason: `${url.hostname} could not be reached: ${detail}` };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { kind: "unavailable", reason: `${url.hostname} redirected to nowhere.` };
      }
      const next = parseWebsiteUrl(new URL(location, current).toString());
      if (next.kind === "invalid") {
        return { kind: "unavailable", reason: `${url.hostname} redirected somewhere we will not follow.` };
      }
      current = next.value;
      continue;
    }

    if (!response.ok) {
      return {
        kind: "unavailable",
        reason: `${url.hostname} answered ${response.status}.`,
      };
    }

    const text = htmlToText(await readCapped(response));
    if (text === "") {
      return { kind: "unavailable", reason: `${url.hostname} returned a page with no readable text.` };
    }

    return { kind: "ok", url: current, text };
  }

  return { kind: "unavailable", reason: "That address redirected too many times." };
}
