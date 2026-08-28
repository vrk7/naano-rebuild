import { describe, expect, it } from "vitest";

import { failures, runDeterministicChecks, type DraftCheck } from "@/lib/draft/checks";
import type { BriefRequirements } from "@/lib/campaign/requirements";

/**
 * The deterministic draft checks.
 *
 * These decide whether somebody's writing passes, and the creator sees the
 * verdict before the brand does — so a rule that fires wrongly costs a person a
 * rewrite they did not need, and one that fails to fire lets a brief go
 * unenforced. Both directions are tested for every rule.
 *
 * PRODUCT.md's evidence rule is the other thing under test here: a check that
 * points at a span must cite it, and one whose finding is an absence must not
 * invent one.
 */

const REQUIREMENTS: BriefRequirements = {
  must_mention: ["Atira", "RFQ turnaround"],
  must_include_link: true,
  banned_claims: ["guaranteed", "fastest in the world"],
  length: { min: 100, max: 400 },
  requires_disclosure: true,
};

const GOOD = [
  "Quote turnaround is where industrial deals go quiet. We measured it across",
  "eleven suppliers and the median RFQ turnaround was four days — long enough",
  "for a buyer to call someone else. Atira cuts it to hours.",
  "Full teardown here: https://atira.example/rfq-teardown",
  "#ad",
].join(" ");

function by(checks: ReadonlyArray<DraftCheck>, label: string): DraftCheck {
  const found = checks.find((check) => check.ruleLabel.includes(label));
  if (!found) throw new Error(`no check matching ${label} in ${checks.map((c) => c.ruleLabel).join(", ")}`);
  return found;
}

describe("a draft that satisfies the brief", () => {
  const checks = runDeterministicChecks(GOOD, REQUIREMENTS);

  it("produces one check per rule, all passing", () => {
    // Two mentions, two banned claims, link, length, disclosure.
    expect(checks).toHaveLength(7);
    expect(failures(checks)).toHaveLength(0);
  });

  it("cites the span it found for each passing rule", () => {
    expect(by(checks, "Atira").evidence).toContain("Atira");
    expect(by(checks, "Includes a link").evidence).toContain("https://atira.example");
    expect(by(checks, "Discloses").evidence).toContain("#ad");
  });
});

describe("required mentions", () => {
  it("matches case-insensitively", () => {
    const checks = runDeterministicChecks("ATIRA cuts quote turnaround.", {
      must_mention: ["Atira"],
    });
    expect(checks[0].status).toBe("pass");
  });

  /** A phrase split across a line break is still the phrase. */
  it("matches across whitespace and line breaks", () => {
    const checks = runDeterministicChecks("We cut RFQ\n   turnaround in half.", {
      must_mention: ["RFQ turnaround"],
    });
    expect(checks[0].status).toBe("pass");
  });

  /**
   * The evidence rule. There is no span to quote for a phrase that is not
   * there, and quoting the opening line instead would be evidence for a claim
   * it is not evidence for.
   */
  it("fails with no evidence and names what it looked for", () => {
    const [check] = runDeterministicChecks("A post about nothing in particular.", {
      must_mention: ["Atira"],
    });

    expect(check.status).toBe("fail");
    expect(check.evidence).toBeNull();
    expect(check.explanation).toContain("Atira");
  });
});

describe("banned claims", () => {
  it("always cites the span when it fails, because the claim is right there", () => {
    const [check] = runDeterministicChecks("This is guaranteed to work for everyone.", {
      banned_claims: ["guaranteed"],
    });

    expect(check.status).toBe("fail");
    expect(check.evidence).toContain("guaranteed");
  });

  it("passes when the claim is absent", () => {
    const [check] = runDeterministicChecks("No promises here.", {
      banned_claims: ["guaranteed"],
    });
    expect(check.status).toBe("pass");
    expect(check.evidence).toBeNull();
  });
});

describe("links", () => {
  it("accepts a bare host, which LinkedIn links on publish", () => {
    const [check] = runDeterministicChecks("More at www.atira.example/teardown", {
      must_include_link: true,
    });
    expect(check.status).toBe("pass");
  });

  it("fails when there is nothing to click", () => {
    const [check] = runDeterministicChecks("Get in touch with us instead.", {
      must_include_link: true,
    });
    expect(check.status).toBe("fail");
    expect(check.evidence).toBeNull();
  });
});

describe("the length band", () => {
  it("measures the draft with its whitespace collapsed", () => {
    const [check] = runDeterministicChecks("  one   two  ", { length: { min: 7, max: 7 } });
    expect(check.status).toBe("pass");
    expect(check.explanation).toContain("7 characters");
  });

  it("fails short and long, and never cites a span", () => {
    const short = runDeterministicChecks("Too short.", { length: { min: 100 } })[0];
    expect(short.status).toBe("fail");
    // The span judged is the whole draft, so quoting part of it would quote the
    // wrong thing. The count is the finding.
    expect(short.evidence).toBeNull();
    expect(short.explanation).toContain("at least 100");

    const long = runDeterministicChecks("x".repeat(500), { length: { max: 400 } })[0];
    expect(long.status).toBe("fail");
    expect(long.explanation).toContain("at most 400");
  });
});

describe("disclosure", () => {
  it("accepts any marker it recognises", () => {
    for (const marker of ["#ad", "#sponsored", "Paid partnership with Atira"]) {
      const [check] = runDeterministicChecks(`A post. ${marker}`, { requires_disclosure: true });
      expect(check.status, marker).toBe("pass");
    }
  });

  it("fails without one and says what would pass", () => {
    const [check] = runDeterministicChecks("A post with no disclosure.", {
      requires_disclosure: true,
    });

    expect(check.status).toBe("fail");
    expect(check.evidence).toBeNull();
    expect(check.explanation).toContain("#ad");
  });
});

/**
 * `creative_freedom` stores `{}`, and PRODUCT.md says those checks "all pass
 * vacuously". No rows, because there were no rules — never because a check
 * could not be run.
 */
describe("a brief that requires nothing", () => {
  it("produces no checks at all", () => {
    expect(runDeterministicChecks("Anything at all.", {})).toEqual([]);
  });
});
