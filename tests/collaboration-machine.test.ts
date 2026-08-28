import { describe, expect, it } from "vitest";

import {
  COLLABORATION_STATES,
  MEASUREMENT_WINDOW_DAYS,
  PRE_PUBLISH_STATES,
  RESPOND_WINDOW_HOURS,
  measurementEndsAt,
  needsAction,
  respondByFrom,
  transition,
  type Action,
  type ActionKind,
  type Actor,
  type CollaborationSnapshot,
  type CollaborationState,
  type Transition,
} from "@/lib/collaboration/machine";

/**
 * The state machine, transition by transition.
 *
 * First on CLAUDE.md's test list and, per SCOPE.md, tested before any UI hangs
 * off it. Two kinds of test here and both matter:
 *
 *   - every row of PRODUCT.md's table, at its guard boundary
 *   - every (state, action) pair the table does *not* contain, refused
 *
 * The second is the one that catches a machine that has quietly grown an edge.
 * A collaboration that can be published without being approved, or accepted
 * twice, is a hole nobody notices until money has moved through it.
 */

const NOW = new Date("2026-08-28T12:00:00.000Z");

function snapshot(overrides: Partial<CollaborationSnapshot> = {}): CollaborationSnapshot {
  return {
    state: "invited",
    respondBy: respondByFrom(NOW),
    approvalRequired: true,
    publishedAt: null,
    ...overrides,
  };
}

function ok(result: Transition) {
  expect(result).toMatchObject({ kind: "ok" });
  if (result.kind !== "ok") throw new Error(result.reason);
  return result;
}

function refused(result: Transition): string {
  expect(result).toMatchObject({ kind: "refused" });
  if (result.kind !== "refused") throw new Error(`expected a refusal, got ${result.state}`);
  return result.reason;
}

describe("invited", () => {
  it("accepts into drafting, and logs the pass through accepted", () => {
    const result = ok(transition(snapshot(), { kind: "accept" }, { now: NOW, by: "creator" }));

    // PRODUCT.md moves accepted -> drafting immediately and by the system.
    // Nothing rests in `accepted`, so the log has to show both steps or it
    // implies the creator did something they did not do.
    expect(result.state).toBe("drafting");
    expect(result.steps).toEqual([
      { from: "invited", to: "accepted", actor: "creator", note: null },
      { from: "accepted", to: "drafting", actor: "system", note: null },
    ]);
  });

  it("declines", () => {
    const result = ok(
      transition(snapshot(), { kind: "decline", note: "  Not my audience.  " }, { now: NOW, by: "creator" }),
    );

    expect(result.state).toBe("declined");
    expect(result.steps[0].note).toBe("Not my audience.");
  });

  it("refuses an accept from the brand", () => {
    expect(
      refused(transition(snapshot(), { kind: "accept" }, { now: NOW, by: "brand" })),
    ).toMatch(/only the creator/i);
  });

  it("refuses a second accept once it is drafting", () => {
    expect(
      refused(
        transition(snapshot({ state: "drafting" }), { kind: "accept" }, { now: NOW, by: "creator" }),
      ),
    ).toMatch(/drafting/i);
  });
});

describe("the 72-hour respond window", () => {
  const respondBy = respondByFrom(NOW);

  it("is 72 hours from the invitation", () => {
    expect(respondBy.getTime() - NOW.getTime()).toBe(RESPOND_WINDOW_HOURS * 60 * 60 * 1000);
  });

  it("accepts a second before the deadline", () => {
    const at = new Date(respondBy.getTime() - 1);
    expect(ok(transition(snapshot(), { kind: "accept" }, { now: at, by: "creator" })).state).toBe(
      "drafting",
    );
  });

  /** The guard is `now < respond_by`, so the deadline itself is closed. */
  it("refuses an accept at the deadline", () => {
    expect(
      refused(transition(snapshot(), { kind: "accept" }, { now: respondBy, by: "creator" })),
    ).toMatch(/window/i);
  });

  it("still lets a late invitation be declined", () => {
    const late = new Date(respondBy.getTime() + 1);
    expect(ok(transition(snapshot(), { kind: "decline" }, { now: late, by: "creator" })).state).toBe(
      "declined",
    );
  });

  it("expires at the deadline and not before", () => {
    const before = new Date(respondBy.getTime() - 1);
    expect(refused(transition(snapshot(), { kind: "expire" }, { now: before, by: "system" }))).toMatch(
      /deadline/i,
    );
    expect(ok(transition(snapshot(), { kind: "expire" }, { now: respondBy, by: "system" })).state).toBe(
      "expired",
    );
  });

  /**
   * A row with no deadline is one nothing in this product created. It is
   * treated as "no deadline", which lets the creator answer and stops the
   * sweep closing it — the opposite reading would silently expire it the
   * moment it was written.
   */
  it("treats a missing deadline as no deadline, in both directions", () => {
    const open = snapshot({ respondBy: null });
    const far = new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000);

    expect(ok(transition(open, { kind: "accept" }, { now: far, by: "creator" })).state).toBe("drafting");
    expect(refused(transition(open, { kind: "expire" }, { now: far, by: "system" }))).toMatch(
      /no deadline/i,
    );
  });
});

describe("drafting", () => {
  it("goes to review when the brand asked to approve", () => {
    const result = ok(
      transition(
        snapshot({ state: "drafting", approvalRequired: true }),
        { kind: "submit_draft" },
        { now: NOW, by: "creator" },
      ),
    );
    expect(result.state).toBe("in_review");
  });

  it("goes straight to approved when they did not", () => {
    const result = ok(
      transition(
        snapshot({ state: "drafting", approvalRequired: false }),
        { kind: "submit_draft" },
        { now: NOW, by: "creator" },
      ),
    );
    expect(result.state).toBe("approved");
  });
});

describe("review", () => {
  const inReview = snapshot({ state: "in_review" });

  it("approves", () => {
    expect(ok(transition(inReview, { kind: "approve" }, { now: NOW, by: "brand" })).state).toBe(
      "approved",
    );
  });

  it("sends back with a note", () => {
    const result = ok(
      transition(
        inReview,
        { kind: "request_changes", note: "The disclosure is missing." },
        { now: NOW, by: "brand" },
      ),
    );
    expect(result.state).toBe("changes_requested");
    expect(result.steps[0].note).toBe("The disclosure is missing.");
  });

  /** Messaging is cut, so this note is the only thing the creator is told. */
  it("refuses to send back with a blank note", () => {
    expect(
      refused(
        transition(inReview, { kind: "request_changes", note: "   " }, { now: NOW, by: "brand" }),
      ),
    ).toMatch(/note/i);
  });

  it("refuses a creator approving their own draft", () => {
    expect(refused(transition(inReview, { kind: "approve" }, { now: NOW, by: "creator" }))).toMatch(
      /only the brand/i,
    );
  });

  it("reopens for drafting after changes were requested", () => {
    expect(
      ok(
        transition(
          snapshot({ state: "changes_requested" }),
          { kind: "revise" },
          { now: NOW, by: "creator" },
        ),
      ).state,
    ).toBe("drafting");
  });
});

describe("publishing and the measurement window", () => {
  const approved = snapshot({ state: "approved" });

  it("publishes with a URL", () => {
    expect(
      ok(
        transition(
          approved,
          { kind: "publish", externalUrl: "https://www.linkedin.com/posts/x" },
          { now: NOW, by: "creator" },
        ),
      ).state,
    ).toBe("published");
  });

  it("refuses to publish without one", () => {
    expect(
      refused(
        transition(approved, { kind: "publish", externalUrl: "  " }, { now: NOW, by: "creator" }),
      ),
    ).toMatch(/url/i);
  });

  it("completes only once the window has run", () => {
    const publishedAt = NOW;
    const published = snapshot({ state: "published", publishedAt });
    const ends = measurementEndsAt(publishedAt);

    expect(ends.getTime() - publishedAt.getTime()).toBe(
      MEASUREMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(
      refused(
        transition(published, { kind: "complete" }, { now: new Date(ends.getTime() - 1), by: "system" }),
      ),
    ).toMatch(/window/i);
    expect(ok(transition(published, { kind: "complete" }, { now: ends, by: "system" })).state).toBe(
      "completed",
    );
  });

  it("refuses to complete a published collaboration with no publication date", () => {
    expect(
      refused(
        transition(
          snapshot({ state: "published", publishedAt: null }),
          { kind: "complete" },
          { now: NOW, by: "system" },
        ),
      ),
    ).toMatch(/publication date/i);
  });
});

describe("cancelling", () => {
  it("is allowed from every pre-publish state", () => {
    for (const state of PRE_PUBLISH_STATES) {
      const result = ok(
        transition(snapshot({ state }), { kind: "cancel" }, { now: NOW, by: "brand" }),
      );
      expect(result.state).toBe("cancelled");
      expect(result.steps[0].from).toBe(state);
    }
  });

  it("is refused once the post is out", () => {
    for (const state of ["published", "completed"] as const) {
      expect(refused(transition(snapshot({ state }), { kind: "cancel" }, { now: NOW, by: "brand" })));
    }
  });

  it("is the brand's alone", () => {
    expect(refused(transition(snapshot(), { kind: "cancel" }, { now: NOW, by: "creator" }))).toMatch(
      /only the brand/i,
    );
  });
});

/**
 * The table, exhaustively.
 *
 * Every action is offered from every state, with its guards satisfied and by
 * the actor PRODUCT.md names. Anything not in the table below has to be
 * refused — that is what stops a new edge appearing by accident.
 */
describe("every (state, action) pair", () => {
  type Case = {
    readonly action: Action;
    readonly by: Actor;
    readonly legalFrom: ReadonlyArray<CollaborationState>;
    readonly to: CollaborationState;
    /** Only where an action needs the world arranged differently to be legal at all. */
    readonly world?: Partial<CollaborationSnapshot>;
  };

  const ACTIONS: ReadonlyArray<Case> = [
    { action: { kind: "accept" }, by: "creator", legalFrom: ["invited"], to: "drafting" },
    { action: { kind: "decline" }, by: "creator", legalFrom: ["invited"], to: "declined" },
    {
      action: { kind: "expire" },
      by: "system",
      legalFrom: ["invited"],
      to: "expired",
      // The one action whose guard is the opposite of accept's: it needs the
      // deadline behind us, where every other case needs it ahead.
      world: { respondBy: NOW },
    },
    { action: { kind: "submit_draft" }, by: "creator", legalFrom: ["drafting"], to: "in_review" },
    { action: { kind: "approve" }, by: "brand", legalFrom: ["in_review"], to: "approved" },
    {
      action: { kind: "request_changes", note: "Add the disclosure." },
      by: "brand",
      legalFrom: ["in_review"],
      to: "changes_requested",
    },
    { action: { kind: "revise" }, by: "creator", legalFrom: ["changes_requested"], to: "drafting" },
    {
      action: { kind: "publish", externalUrl: "https://www.linkedin.com/posts/x" },
      by: "creator",
      legalFrom: ["approved"],
      to: "published",
    },
    { action: { kind: "complete" }, by: "system", legalFrom: ["published"], to: "completed" },
    { action: { kind: "cancel" }, by: "brand", legalFrom: PRE_PUBLISH_STATES, to: "cancelled" },
  ];

  // Guards satisfied everywhere: the deadline is in the future, the
  // measurement window has run. Only the state and the action vary.
  const AFTER_WINDOW = new Date(NOW.getTime() + (MEASUREMENT_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000);

  for (const { action, by, legalFrom, to, world } of ACTIONS) {
    for (const state of COLLABORATION_STATES) {
      const legal = legalFrom.includes(state);
      const label = `${action.kind} from ${state}`;

      it(legal ? `allows ${label}` : `refuses ${label}`, () => {
        const result = transition(
          snapshot({
            state,
            respondBy: new Date(AFTER_WINDOW.getTime() + 1),
            publishedAt: NOW,
            ...world,
          }),
          action,
          { now: AFTER_WINDOW, by },
        );

        if (legal) {
          expect(ok(result).state).toBe(to);
        } else {
          expect(result.kind).toBe("refused");
        }
      });
    }
  }

  it("covers every action kind the machine defines", () => {
    const kinds = new Set<ActionKind>(ACTIONS.map((entry) => entry.action.kind));
    expect(kinds.size).toBe(ACTIONS.length);
  });
});

describe("needsAction", () => {
  /** PRODUCT.md, "Derived, not stored". Both sides' tab counts come from this. */
  const CREATOR_TURN: ReadonlyArray<CollaborationState> = [
    "invited",
    "drafting",
    "changes_requested",
    "approved",
  ];

  for (const state of COLLABORATION_STATES) {
    it(`says whose turn ${state} is`, () => {
      expect(needsAction(state, "creator")).toBe(CREATOR_TURN.includes(state));
      expect(needsAction(state, "brand")).toBe(state === "in_review");
    });
  }
});
