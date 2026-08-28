import { describe, expect, it } from "vitest";

import { buildVocabulary } from "@/lib/brand/intelligence";
import { parseIcpForm, type IcpEdit } from "@/lib/brand/icp-form";
import type { ParseResult } from "@/lib/parse";

/**
 * The ICP editor's form.
 *
 * PRODUCT.md's enabling change: "The ICP is structured targets", not prose.
 * Which makes this form the input every match score in the workspace is
 * computed from — an `icp_target` row holding a value outside the vocabulary
 * joins to no audience facet and quietly drags a dimension's overlap to zero.
 */

const TOPICS = [
  { id: "t-saas", slug: "saas", label: "SaaS", kind: "industry" as const },
  { id: "t-manufacturing", slug: "manufacturing", label: "Manufacturing", kind: "industry" as const },
  { id: "t-sales", slug: "sales", label: "Sales", kind: "function" as const },
  { id: "t-engineering", slug: "engineering", label: "Engineering", kind: "function" as const },
];

const VOCABULARY = buildVocabulary(TOPICS);

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  }
  return data;
}

const FILLED = {
  id: "icp-1",
  rank: "1",
  label: "Sales engineering leaders",
  description: "They own quote turnaround.",
  is_active: "on",
  job_function: ["sales", "engineering"],
  seniority: ["manager", "director"],
  industry: ["manufacturing"],
  geo: ["DE", "NL"],
};

function ok(result: ParseResult<IcpEdit>): IcpEdit {
  expect(result).toMatchObject({ kind: "ok" });
  if (result.kind !== "ok") throw new Error(result.error);
  return result.value;
}

function error(result: ParseResult<IcpEdit>): string {
  expect(result).toMatchObject({ kind: "invalid" });
  if (result.kind !== "invalid") throw new Error("expected a refusal");
  return result.error;
}

describe("a saved ICP", () => {
  it("carries its chips, dimension by dimension", () => {
    const edit = ok(parseIcpForm(form(FILLED), VOCABULARY));

    expect(edit).toEqual({
      id: "icp-1",
      rank: 1,
      label: "Sales engineering leaders",
      description: "They own quote turnaround.",
      isActive: true,
      targets: {
        job_function: ["sales", "engineering"],
        seniority: ["manager", "director"],
        industry: ["manufacturing"],
        geo: ["DE", "NL"],
      },
    });
  });

  it("treats a blank id as a new ICP at that rank", () => {
    expect(ok(parseIcpForm(form({ ...FILLED, id: "" }), VOCABULARY)).id).toBeNull();
    const withoutId = { ...FILLED } as Record<string, string | string[]>;
    delete withoutId.id;
    expect(ok(parseIcpForm(form(withoutId), VOCABULARY)).id).toBeNull();
  });

  /** An unchecked box is absent from the submission, and that is the "off". */
  it("reads a missing active box as parked", () => {
    const parked = { ...FILLED } as Record<string, string | string[]>;
    delete parked.is_active;
    expect(ok(parseIcpForm(form(parked), VOCABULARY)).isActive).toBe(false);
  });

  it("de-duplicates a dimension", () => {
    expect(
      ok(parseIcpForm(form({ ...FILLED, geo: ["DE", "DE", "NL"] }), VOCABULARY)).targets.geo,
    ).toEqual(["DE", "NL"]);
  });

  /**
   * Allowed on the way to a saved ICP. The marketplace already refuses to rank
   * against an ICP with no targets and says so; blocking the save would strand
   * a brand who cleared a dimension to redo it.
   */
  it("allows an ICP with nothing selected yet", () => {
    const edit = ok(
      parseIcpForm(form({ id: "icp-1", rank: "2", label: "Work in progress" }), VOCABULARY),
    );
    expect(edit.targets).toEqual({ job_function: [], seniority: [], industry: [], geo: [] });
    expect(edit.description).toBe("");
  });
});

describe("input that did not come from the chips", () => {
  it("refuses a value outside the vocabulary on every dimension", () => {
    expect(error(parseIcpForm(form({ ...FILLED, geo: ["UK"] }), VOCABULARY))).toMatch(/"UK"/);
    expect(error(parseIcpForm(form({ ...FILLED, industry: ["mining"] }), VOCABULARY))).toMatch(
      /"mining"/,
    );
    expect(
      error(parseIcpForm(form({ ...FILLED, job_function: ["procurement"] }), VOCABULARY)),
    ).toMatch(/"procurement"/);
    expect(error(parseIcpForm(form({ ...FILLED, seniority: ["head-of"] }), VOCABULARY))).toMatch(
      /"head-of"/,
    );
  });

  it("refuses a rank outside 1..3", () => {
    for (const rank of ["0", "4", "", "two", "1.5"]) {
      expect(error(parseIcpForm(form({ ...FILLED, rank }), VOCABULARY))).toMatch(/ranked 1 to 3/);
    }
  });

  it("refuses an ICP with no name", () => {
    expect(error(parseIcpForm(form({ ...FILLED, label: "   " }), VOCABULARY))).toMatch(/required/i);
  });

  it("refuses a description longer than the column shows", () => {
    expect(
      error(parseIcpForm(form({ ...FILLED, description: "x".repeat(1001) }), VOCABULARY)),
    ).toMatch(/under 1000/);
  });
});
