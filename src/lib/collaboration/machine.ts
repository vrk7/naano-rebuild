/**
 * The collaboration state machine (PRODUCT.md, "Collaboration state machine").
 *
 * Pure. No Supabase, no dates read from the clock, no formatting — `now` is a
 * parameter so every guard is testable at its boundary. This is the first item
 * on CLAUDE.md's test list, and SCOPE.md puts it before any UI hangs off it.
 *
 * The whole product's "needs action" surfaces are derived from `state` plus
 * whose turn it is, so this file also owns `needsAction`. One field, not two
 * divergent inboxes.
 *
 * What this file does *not* do is decide who the caller is. It is told, in
 * `context.by`, and refuses when the actor does not match the row in
 * PRODUCT.md's table. Establishing that the session really is that actor
 * belongs to the query layer and to RLS.
 */

export const COLLABORATION_STATES = [
  "invited",
  "accepted",
  "drafting",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "completed",
  "declined",
  "expired",
  "cancelled",
] as const;

export type CollaborationState = (typeof COLLABORATION_STATES)[number];

export const ACTORS = ["brand", "creator", "system"] as const;
export type Actor = (typeof ACTORS)[number];

export const STATE_LABEL: Readonly<Record<CollaborationState, string>> = {
  invited: "Invited",
  accepted: "Accepted",
  drafting: "Drafting",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

/**
 * How long a creator has to answer an invitation.
 *
 * PRODUCT.md chooses 72 hours rather than inheriting naano's truncated
 * sentence (`brand/15`): long enough to cover a weekend, short enough that a
 * brand's budget is not committed for a week on a creator who has gone quiet.
 * There is no measurement behind it.
 */
export const RESPOND_WINDOW_HOURS = 72;

/**
 * How long after publishing we keep attributing engagement to the
 * collaboration for the purpose of closing it.
 *
 * 14 days, matching the default `post_by` horizon naano uses (`brand/14`).
 * Also a guess. Engagements arriving later still land on the post; they just do
 * not hold the collaboration open.
 */
export const MEASUREMENT_WINDOW_DAYS = 14;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function respondByFrom(now: Date): Date {
  return new Date(now.getTime() + RESPOND_WINDOW_HOURS * HOUR_MS);
}

export function measurementEndsAt(publishedAt: Date): Date {
  return new Date(publishedAt.getTime() + MEASUREMENT_WINDOW_DAYS * DAY_MS);
}

/**
 * States a collaboration can still move out of under its own steam.
 *
 * `published` is not terminal — the measurement window closes it — and the four
 * below are where it stops. Booking reads this to refuse a second live
 * collaboration between the same campaign and creator.
 */
export const TERMINAL_STATES: ReadonlyArray<CollaborationState> = [
  "completed",
  "declined",
  "expired",
  "cancelled",
];

/** Every state before publication, which is exactly what a brand may cancel. */
export const PRE_PUBLISH_STATES: ReadonlyArray<CollaborationState> = [
  "invited",
  "accepted",
  "drafting",
  "in_review",
  "changes_requested",
  "approved",
];

export function isTerminal(state: CollaborationState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function isOpen(state: CollaborationState): boolean {
  return !isTerminal(state);
}

/**
 * Whose turn it is (PRODUCT.md, "Derived, not stored").
 *
 * Both sides' tab counts come from this one function, so a state can never be
 * waiting on nobody in one inbox and on everybody in the other.
 */
export function needsAction(
  state: CollaborationState,
  viewer: "brand" | "creator",
): boolean {
  if (viewer === "creator") {
    return (
      state === "invited" ||
      state === "drafting" ||
      state === "changes_requested" ||
      state === "approved"
    );
  }
  return state === "in_review";
}

export type Action =
  | { readonly kind: "accept" }
  | { readonly kind: "decline"; readonly note?: string }
  | { readonly kind: "expire" }
  | { readonly kind: "submit_draft" }
  | { readonly kind: "approve" }
  | { readonly kind: "request_changes"; readonly note: string }
  | { readonly kind: "revise" }
  | { readonly kind: "publish"; readonly externalUrl: string }
  | { readonly kind: "complete" }
  | { readonly kind: "cancel"; readonly note?: string };

export type ActionKind = Action["kind"];

/**
 * What a guard is allowed to read.
 *
 * Deliberately not the whole row: a guard that could see the price or the
 * creator would invite rules that are not in PRODUCT.md's table.
 */
export type CollaborationSnapshot = {
  readonly state: CollaborationState;
  readonly respondBy: Date | null;
  readonly approvalRequired: boolean;
  readonly publishedAt: Date | null;
};

export type TransitionContext = {
  readonly now: Date;
  /** Who is asking. Refused when it is not the actor PRODUCT.md names. */
  readonly by: Actor;
};

export type TransitionStep = {
  readonly from: CollaborationState;
  readonly to: CollaborationState;
  readonly actor: Actor;
  readonly note: string | null;
};

export type Transition =
  | {
      readonly kind: "ok";
      /** In order. More than one when a state is passed straight through. */
      readonly steps: ReadonlyArray<TransitionStep>;
      readonly state: CollaborationState;
    }
  | { readonly kind: "refused"; readonly reason: string };

function refuse(reason: string): Transition {
  return { kind: "refused", reason };
}

function move(steps: ReadonlyArray<TransitionStep>): Transition {
  return { kind: "ok", steps, state: steps[steps.length - 1].to };
}

function step(
  from: CollaborationState,
  to: CollaborationState,
  actor: Actor,
  note: string | null = null,
): TransitionStep {
  return { from, to, actor, note };
}

/**
 * The two refusals every action shares, in the order a caller hits them.
 *
 * Both sentences reach a person, so they need different halves of the verb:
 * "it cannot be accepted" and "only the creator can accept an invitation".
 */
function unavailable(
  snapshot: CollaborationSnapshot,
  context: TransitionContext,
  allowed: ReadonlyArray<CollaborationState>,
  actor: Actor,
  words: { readonly done: string; readonly act: string },
): Transition | null {
  if (!allowed.includes(snapshot.state)) {
    return refuse(
      `This collaboration is ${STATE_LABEL[snapshot.state].toLowerCase()}, so it cannot be ${words.done}.`,
    );
  }
  if (context.by !== actor) {
    return refuse(`Only the ${actor} can ${words.act}.`);
  }
  return null;
}

/**
 * Applies one action, or says why it will not.
 *
 * Returns the steps to append to `collaboration_event` rather than writing
 * anything. An accepted invitation produces two of them: PRODUCT.md's table
 * moves `accepted -> drafting` immediately and by the system, so nothing ever
 * rests in `accepted` and the log says so rather than implying a creator did
 * both.
 */
export function transition(
  snapshot: CollaborationSnapshot,
  action: Action,
  context: TransitionContext,
): Transition {
  const { state } = snapshot;

  switch (action.kind) {
    case "accept": {
      const no = unavailable(snapshot, context, ["invited"], "creator", {
        done: "accepted",
        act: "accept an invitation",
      });
      if (no) return no;
      /*
       * A null respond_by is "no deadline was set", not "the deadline has
       * passed". Booking always sets one; a row without it came from somewhere
       * else, and refusing a creator for a deadline nobody gave them would be
       * the worse failure.
       */
      if (snapshot.respondBy !== null && context.now >= snapshot.respondBy) {
        return refuse("The window to answer this invitation has closed.");
      }
      return move([
        step(state, "accepted", "creator"),
        step("accepted", "drafting", "system"),
      ]);
    }

    case "decline": {
      const no = unavailable(snapshot, context, ["invited"], "creator", {
        done: "declined",
        act: "decline an invitation",
      });
      if (no) return no;
      return move([step(state, "declined", "creator", note(action.note))]);
    }

    case "expire": {
      const no = unavailable(snapshot, context, ["invited"], "system", {
        done: "expired",
        act: "expire an invitation",
      });
      if (no) return no;
      // The mirror of accept: with no deadline recorded there is nothing to
      // have passed, so the sweep leaves the row alone rather than closing it.
      if (snapshot.respondBy === null) {
        return refuse("This invitation has no deadline, so it cannot expire.");
      }
      if (context.now < snapshot.respondBy) {
        return refuse("This invitation has not reached its deadline yet.");
      }
      return move([step(state, "expired", "system")]);
    }

    case "submit_draft": {
      const no = unavailable(snapshot, context, ["drafting"], "creator", {
        done: "submitted",
        act: "submit a draft",
      });
      if (no) return no;
      /*
       * The one branch in the machine. `approval_required` is set at booking
       * and decides whether the brand sees the draft before it is published or
       * only after — which is the whole of what the brand chose when they
       * ticked the box.
       */
      return move([
        step(state, snapshot.approvalRequired ? "in_review" : "approved", "creator"),
      ]);
    }

    case "approve": {
      const no = unavailable(snapshot, context, ["in_review"], "brand", {
        done: "approved",
        act: "approve a draft",
      });
      if (no) return no;
      return move([step(state, "approved", "brand")]);
    }

    case "request_changes": {
      const no = unavailable(
        snapshot,
        context,
        ["in_review"],
        "brand",
        { done: "sent back for changes", act: "send a draft back for changes" },
      );
      if (no) return no;
      /*
       * PRODUCT.md makes the note a guard rather than a courtesy. SCOPE.md cuts
       * messaging, so this note is the only channel a brand has for saying what
       * is wrong; without it the creator is told to try again and nothing else.
       */
      const written = note(action.note);
      if (written === null) {
        return refuse("Say what needs changing. The note is the only thing the creator gets.");
      }
      return move([step(state, "changes_requested", "brand", written)]);
    }

    case "revise": {
      const no = unavailable(
        snapshot,
        context,
        ["changes_requested"],
        "creator",
        { done: "reopened for drafting", act: "reopen a draft" },
      );
      if (no) return no;
      return move([step(state, "drafting", "creator")]);
    }

    case "publish": {
      const no = unavailable(snapshot, context, ["approved"], "creator", {
        done: "published",
        act: "publish this post",
      });
      if (no) return no;
      // The post exists on LinkedIn or it does not. We do not publish, so the
      // URL the creator pastes is the only evidence there is.
      if (note(action.externalUrl) === null) {
        return refuse("Paste the URL of the published post.");
      }
      return move([step(state, "published", "creator")]);
    }

    case "complete": {
      const no = unavailable(snapshot, context, ["published"], "system", {
        done: "completed",
        act: "close a collaboration",
      });
      if (no) return no;
      if (snapshot.publishedAt === null) {
        return refuse("This collaboration has no publication date to measure from.");
      }
      if (context.now < measurementEndsAt(snapshot.publishedAt)) {
        return refuse("The measurement window is still open.");
      }
      return move([step(state, "completed", "system")]);
    }

    case "cancel": {
      const no = unavailable(snapshot, context, PRE_PUBLISH_STATES, "brand", {
        done: "cancelled",
        act: "cancel a booking",
      });
      if (no) return no;
      return move([step(state, "cancelled", "brand", note(action.note))]);
    }
  }
}

/** Blank notes are absent notes; storing "   " would satisfy a guard and say nothing. */
function note(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}
