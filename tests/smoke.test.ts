import { describe, expect, it } from "vitest";

/**
 * Harness smoke test. Its only job is to prove the runner is wired, so that
 * writing the first real test is editing a file rather than setting up a
 * toolchain.
 *
 * Per CLAUDE.md there is no coverage target. Real tests belong to exactly four
 * things: state machine transitions, budget and projection math, LLM response
 * parsing, and access control. Nothing for UI plumbing.
 */
describe("test harness", () => {
  it("runs", () => {
    expect(true).toBe(true);
  });

  it("has working async support", async () => {
    await expect(Promise.resolve("ok")).resolves.toBe("ok");
  });
});
