/**
 * Parsing the one creator signup screen.
 *
 * naano asks a creator for five screens' worth of detail: LinkedIn URL,
 * country, industries, price, an optional bundle, and an optional professional
 * information step covering registered activity and invoicing
 * (`recon/creator/01`–`creator/06`). Four of those collect things nothing in
 * the product reads. What a listing actually needs to exist is a profile URL,
 * the industries it can be filtered by, and a price — so that is the screen.
 *
 * Pure. No Supabase, no FormData beyond reading it, so the validation can be
 * tested without a network. Everything here crosses a boundary from a public
 * page, which CLAUDE.md requires parsing into a known shape rather than casting.
 */

/** `creator_rate.price_cents` is a Postgres `int`. Beyond this the insert fails. */
const MAX_PRICE_CENTS = 2_147_483_647;

/** PRODUCT.md caps `creator_topic` at 3 per creator; a database trigger backs it. */
export const MAX_TOPICS = 3;

export type CreatorListingInput = {
  readonly linkedinUrl: string;
  readonly displayName: string;
  readonly topicIds: ReadonlyArray<string>;
  readonly priceCents: number;
};

export type ParseResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "invalid"; readonly error: string };

/**
 * Accepts a public LinkedIn profile URL and normalises it.
 *
 * `creator.linkedin_url` is unique, so two spellings of one profile —
 * `linkedin.com/in/x`, `https://www.linkedin.com/in/x/?trk=nav` — have to
 * collapse to the same string or the constraint stops meaning anything.
 * Country subdomains (`de.linkedin.com`) are accepted and folded into the
 * canonical host for the same reason.
 */
export function parseLinkedinUrl(raw: unknown): ParseResult<string> {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { kind: "invalid", error: "Enter your public LinkedIn profile URL." };
  }

  const trimmed = raw.trim();
  // Accept a pasted URL with no scheme, which is how most people copy one.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { kind: "invalid", error: "That does not look like a URL." };
  }

  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
    return { kind: "invalid", error: "That is not a linkedin.com URL." };
  }

  const match = url.pathname.match(/^\/in\/([^/]+)\/?$/);
  if (!match) {
    return {
      kind: "invalid",
      error: "Use your profile URL, the one that looks like linkedin.com/in/your-name.",
    };
  }

  const slug = decodeURIComponent(match[1]).toLowerCase();
  if (slug.length > 100) {
    return { kind: "invalid", error: "That profile URL is too long to be real." };
  }

  // Query and fragment are dropped: `?trk=...` is tracking, never identity.
  return { kind: "ok", value: `https://www.linkedin.com/in/${slug}` };
}

/**
 * The display name, taken from the profile URL.
 *
 * We do not scrape LinkedIn (SCOPE.md, "The decision everything else hangs
 * on"), so unlike naano we cannot read a name, photo, headline, country and
 * follower count off the profile. Asking for the name as a fourth field is the
 * alternative; deriving it from the slug the creator already gave us keeps the
 * screen to what it needs and is what the URL means.
 *
 * Vanity URLs usually end in a disambiguating id — `mateo-jansen-1a2b3c4` — so
 * trailing segments containing a digit are dropped. If that leaves nothing, the
 * whole slug is used rather than an empty name: a handle like `8bitdave` is a
 * name, it just is not a first and last one.
 */
export function displayNameFromSlug(url: string): string {
  const slug = url.slice(url.lastIndexOf("/") + 1);
  const segments = slug.split("-").filter((part) => part.length > 0);

  const named = [...segments];
  while (named.length > 0 && /\d/.test(named[named.length - 1])) named.pop();

  const words = named.length > 0 ? named : segments;
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Price per post, given in whole currency units, stored in cents.
 *
 * Parsed off the string rather than through `parseFloat` and a multiply:
 * `12.10 * 100` is 1209.9999999999998, and a rate that rounds down by a cent
 * every time it is read is the kind of quiet arithmetic error that only shows
 * up in a reconciliation months later.
 */
export function parsePriceCents(raw: unknown): ParseResult<number> {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { kind: "invalid", error: "Enter your price per post." };
  }

  const cleaned = raw.trim().replace(/,/g, "");
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return { kind: "invalid", error: "Enter the price as a number, such as 1200 or 1200.50." };
  }

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const cents = whole * 100 + fraction;

  if (!Number.isSafeInteger(cents) || cents > MAX_PRICE_CENTS) {
    return { kind: "invalid", error: "That price is larger than we can store." };
  }

  return { kind: "ok", value: cents };
}

/** Topic ids arrive as repeated form fields; the database column is a uuid. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTopicIds(raw: ReadonlyArray<FormDataEntryValue>): ParseResult<string[]> {
  const ids: string[] = [];

  for (const entry of raw) {
    if (typeof entry !== "string" || !UUID.test(entry)) {
      return { kind: "invalid", error: "One of those industries was not recognised." };
    }
    // A duplicate would violate the (creator_id, topic_id) primary key, and it
    // is a repeated checkbox rather than a second choice.
    if (!ids.includes(entry)) ids.push(entry);
  }

  if (ids.length === 0) {
    return { kind: "invalid", error: "Pick at least one industry." };
  }
  if (ids.length > MAX_TOPICS) {
    return { kind: "invalid", error: `Pick at most ${MAX_TOPICS} industries.` };
  }

  return { kind: "ok", value: ids };
}

/** The whole screen, parsed. The first failure is the one reported. */
export function parseCreatorListing(formData: FormData): ParseResult<CreatorListingInput> {
  const linkedin = parseLinkedinUrl(formData.get("linkedinUrl"));
  if (linkedin.kind === "invalid") return linkedin;

  const topics = parseTopicIds(formData.getAll("topics"));
  if (topics.kind === "invalid") return topics;

  const price = parsePriceCents(formData.get("price"));
  if (price.kind === "invalid") return price;

  return {
    kind: "ok",
    value: {
      linkedinUrl: linkedin.value,
      displayName: displayNameFromSlug(linkedin.value),
      topicIds: topics.value,
      priceCents: price.value,
    },
  };
}
