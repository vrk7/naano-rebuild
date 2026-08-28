/**
 * Parsing what a creator submits (PRODUCT.md steps 9 and 11).
 *
 * Two things cross a boundary here: the draft itself, and the URL of the post
 * once it is live. Both are typed by a person into a form and both are stored,
 * so both are parsed rather than trusted. Pure — no Supabase, no FormData
 * beyond reading it.
 */

import { invalid, ok, type ParseResult } from "@/lib/parse";
import { LINKEDIN_POST_MAX_CHARS } from "@/lib/campaign/requirements";

export function parseDraftBody(raw: unknown): ParseResult<string> {
  if (typeof raw !== "string" || raw.trim() === "") {
    return invalid("Write the post before submitting it.");
  }

  const body = raw.trim();
  if (body.length > LINKEDIN_POST_MAX_CHARS) {
    return invalid(
      `LinkedIn refuses a post over ${LINKEDIN_POST_MAX_CHARS.toLocaleString()} characters, and this one is ${body.length.toLocaleString()}.`,
    );
  }

  return ok(body);
}

export function parseDraftForm(formData: FormData): ParseResult<string> {
  return parseDraftBody(formData.get("body"));
}

/**
 * The URL of the published post.
 *
 * We do not publish — SCOPE.md is explicit that the creator posts to LinkedIn
 * themselves and pastes the link back — so this string is the only evidence the
 * post exists. `creator_post.external_url` is unique, which makes two
 * collaborations claiming one post a constraint violation rather than a
 * duplicate lead, and that only holds if the same post always normalises to the
 * same string.
 *
 * Both shapes LinkedIn hands out are accepted: the share URL you get from
 * "Copy link to post", and the feed URL with the activity URN in it.
 */
export function parsePostUrl(raw: unknown): ParseResult<string> {
  if (typeof raw !== "string" || raw.trim() === "") {
    return invalid("Paste the link to your published post.");
  }

  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return invalid("That does not look like a URL.");
  }

  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
    return invalid("That is not a linkedin.com link.");
  }

  const path = url.pathname.replace(/\/+$/, "");

  // Two shapes, and nothing else: a profile or a company page is not a post,
  // and recording one as though it were would put a lead source on a page
  // nobody engaged with.
  const isShare = /^\/posts\/[^/]+$/.test(path);
  const isFeedUpdate = /^\/feed\/update\/urn:li:(activity|share|ugcPost):\d+$/.test(path);

  if (!isShare && !isFeedUpdate) {
    return invalid(
      "Use the link to the post itself — the one that looks like linkedin.com/posts/… or linkedin.com/feed/update/….",
    );
  }

  // Query and fragment are dropped: `?utm_source=share` is tracking, never
  // identity, and keeping it would let one post be recorded twice.
  return ok(`https://www.linkedin.com${path}`);
}

export function parsePublishForm(formData: FormData): ParseResult<string> {
  return parsePostUrl(formData.get("external_url"));
}
