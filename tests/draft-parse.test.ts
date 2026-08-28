import { describe, expect, it } from "vitest";

import { parseDraftBody, parsePostUrl } from "@/lib/draft/parse";
import { LINKEDIN_POST_MAX_CHARS } from "@/lib/campaign/requirements";
import type { ParseResult } from "@/lib/parse";

function ok(result: ParseResult<string>): string {
  expect(result).toMatchObject({ kind: "ok" });
  if (result.kind !== "ok") throw new Error(result.error);
  return result.value;
}

function error(result: ParseResult<string>): string {
  expect(result).toMatchObject({ kind: "invalid" });
  if (result.kind !== "invalid") throw new Error(`expected a refusal, got ${result.value}`);
  return result.error;
}

describe("the draft body", () => {
  it("keeps the writing and trims the edges", () => {
    expect(ok(parseDraftBody("  A post.\n\nWith two paragraphs.  "))).toBe(
      "A post.\n\nWith two paragraphs.",
    );
  });

  it("refuses an empty draft", () => {
    expect(error(parseDraftBody("   "))).toMatch(/write the post/i);
    expect(error(parseDraftBody(null))).toMatch(/write the post/i);
  });

  /** Not a guess: LinkedIn refuses a longer post, so it could never be published. */
  it("refuses one LinkedIn would not accept", () => {
    expect(ok(parseDraftBody("x".repeat(LINKEDIN_POST_MAX_CHARS)))).toHaveLength(
      LINKEDIN_POST_MAX_CHARS,
    );
    expect(error(parseDraftBody("x".repeat(LINKEDIN_POST_MAX_CHARS + 1)))).toMatch(/3,000/);
  });
});

describe("the published post URL", () => {
  it("accepts the share link", () => {
    expect(ok(parsePostUrl("https://www.linkedin.com/posts/marta-cunha_rfq-activity-7212345678901234567-AbCd"))).toBe(
      "https://www.linkedin.com/posts/marta-cunha_rfq-activity-7212345678901234567-AbCd",
    );
  });

  it("accepts the feed URL with an activity URN", () => {
    expect(ok(parsePostUrl("linkedin.com/feed/update/urn:li:activity:7212345678901234567/"))).toBe(
      "https://www.linkedin.com/feed/update/urn:li:activity:7212345678901234567",
    );
  });

  /**
   * `creator_post.external_url` is unique, so one post has to normalise to one
   * string or the constraint stops meaning anything.
   */
  it("normalises the spellings of one post to one string", () => {
    const canonical = "https://www.linkedin.com/posts/marta_a-activity-72123-Ab";
    for (const spelling of [
      "https://www.linkedin.com/posts/marta_a-activity-72123-Ab/",
      "https://www.linkedin.com/posts/marta_a-activity-72123-Ab?utm_source=share",
      "http://linkedin.com/posts/marta_a-activity-72123-Ab",
      "de.linkedin.com/posts/marta_a-activity-72123-Ab",
    ]) {
      expect(ok(parsePostUrl(spelling)), spelling).toBe(canonical);
    }
  });

  it("refuses something that is not a post", () => {
    expect(error(parsePostUrl("https://www.linkedin.com/in/marta-cunha"))).toMatch(/post itself/i);
    expect(error(parsePostUrl("https://www.linkedin.com/company/atira"))).toMatch(/post itself/i);
    expect(error(parsePostUrl("https://example.com/posts/123"))).toMatch(/linkedin\.com/i);
    expect(error(parsePostUrl(""))).toMatch(/paste the link/i);
  });
});
