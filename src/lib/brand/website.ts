/**
 * Reading the one field onboarding asks for (PRODUCT.md step 2).
 *
 * Pure. The URL a brand pastes is untrusted input that this server is about to
 * make a request to, so what is and is not a website we will fetch is decided
 * here, where it can be tested, rather than inside the fetch.
 */

import { invalid, ok, type ParseResult } from "@/lib/parse";

/**
 * Hosts that are never a brand's website.
 *
 * The point is not tidiness. `fetch` runs on our server, so a pasted
 * `http://localhost:3000/admin` or a link to a cloud metadata endpoint is a
 * request made with our network position — the classic server-side request
 * forgery. Names are refused here; addresses are refused again after DNS
 * resolution in `fetch-website.ts`, because a public name can resolve to a
 * private address.
 */
const BLOCKED_SUFFIXES: ReadonlyArray<string> = [
  ".local",
  ".internal",
  ".localhost",
  ".test",
  ".example",
  ".invalid",
  ".onion",
];

const BLOCKED_HOSTS: ReadonlyArray<string> = ["localhost", "metadata.google.internal"];

/** Long enough for any real domain; past it the input is not a hostname. */
const MAX_URL_CHARS = 2000;

export function parseWebsiteUrl(raw: unknown): ParseResult<string> {
  if (typeof raw !== "string" || raw.trim() === "") {
    return invalid("Paste your website address.");
  }

  const trimmed = raw.trim();
  if (trimmed.length > MAX_URL_CHARS) {
    return invalid("That address is too long to be one.");
  }

  // Most people copy a website without its scheme.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return invalid("That does not look like a web address.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return invalid("Only http and https addresses can be read.");
  }

  // Credentials in a URL are never part of a public marketing site, and
  // forwarding them would send someone's password to their own server.
  if (url.username !== "" || url.password !== "") {
    return invalid("Leave the username and password out of the address.");
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.includes(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return invalid("That address points somewhere private, not at a public website.");
  }

  // An IP literal skips DNS entirely, so the resolution check downstream would
  // never see it. A brand's website has a name.
  if (isIpLiteral(host)) {
    return invalid("Enter your website's address, not an IP.");
  }

  if (!host.includes(".")) {
    return invalid("That address has no domain in it.");
  }

  // Query and fragment are dropped: they are tracking or in-page anchors, and
  // neither changes what the page says.
  return ok(`${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname}`);
}

export function isIpLiteral(host: string): boolean {
  // URL puts IPv6 hosts in brackets, which is the only place they can appear.
  if (host.startsWith("[")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * Everything the model is allowed to see, and no markup.
 *
 * Not a parser — an extractor. The model is asked what a company sells and to
 * whom, and `<script>` contents, inline CSS and tag soup are noise that costs
 * tokens and invites the page's own text to look like instructions.
 */
const STRIPPED_ELEMENTS = ["script", "style", "noscript", "svg", "template", "iframe"];

/**
 * Everything past this is footer, cookie banner and legal boilerplate on every
 * marketing site we have looked at. It bounds what one generation costs. The
 * number is a guess with nothing measured behind it.
 */
export const MAX_TEXT_CHARS = 12_000;

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
};

export function htmlToText(html: string): string {
  let text = html;

  for (const element of STRIPPED_ELEMENTS) {
    text = text.replace(new RegExp(`<${element}\\b[^>]*>[\\s\\S]*?</${element}>`, "gi"), " ");
    // An unclosed <script> would otherwise leave its body in the output.
    text = text.replace(new RegExp(`<${element}\\b[^>]*>[\\s\\S]*$`, "gi"), " ");
  }

  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<[^>]+>/g, " ");

  text = text.replace(/&([a-z]+|#x?[0-9a-f]+);/gi, (match, name: string) => {
    const known = ENTITIES[name.toLowerCase()];
    if (known !== undefined) return known;
    // A numeric entity we do not have a name for is still decodable.
    const numeric = /^#x([0-9a-f]+)$/i.exec(name) ?? /^#(\d+)$/.exec(name);
    if (!numeric) return match;
    const code = Number.parseInt(numeric[1], name.toLowerCase().startsWith("#x") ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });

  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}
