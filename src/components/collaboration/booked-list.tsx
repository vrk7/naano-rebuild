import Link from "next/link";

import { STATE_LABEL, needsAction, type CollaborationState } from "@/lib/collaboration/machine";
import { formatCents } from "@/lib/posts/metrics";
import type { CampaignCollaboration } from "@/lib/collaboration/queries";

/**
 * Who a campaign has booked, and whose turn each one is.
 *
 * The "waiting on you" marker is `needsAction`, the same derivation the creator
 * side uses. PRODUCT.md is explicit that both sides' counts come from one
 * function rather than two inboxes that can disagree about the same row.
 */
export function BookedList({
  collaborations,
  campaignId,
  now,
}: {
  collaborations: ReadonlyArray<CampaignCollaboration>;
  campaignId: string;
  now: Date;
}) {
  return (
    <ul className="mt-4 space-y-3">
      {collaborations.map((collaboration) => (
        <li key={collaboration.id} className="rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Link
              href={`/brand/collaborations/${collaboration.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {collaboration.creator.displayName}
            </Link>
            <span className="flex items-center gap-2 text-xs">
              {needsAction(collaboration.state, "brand") ? (
                <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
                  Waiting on you
                </span>
              ) : null}
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {STATE_LABEL[collaboration.state]}
              </span>
            </span>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {formatCents(collaboration.priceCents)} committed
            {collaboration.postBy ? ` · post by ${collaboration.postBy}` : ""}
            {collaboration.approvalRequired ? " · you approve the draft" : " · no approval needed"}
          </p>

          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {status(collaboration, now)}
          </p>

          {/* The collaboration is what the name links to, because that is where
              the draft and the decision live. The score that produced the
              booking is a click away rather than gone. */}
          <Link
            href={`/brand/creators/${collaboration.creator.id}?campaign=${campaignId}`}
            className="mt-1 inline-block text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Creator profile and score →
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The sentence under a booking.
 *
 * An invitation past its deadline says so rather than reading as still open.
 * The row still holds `invited` — nothing sweeps it, and PRODUCT.md's expiry is
 * a system transition that has no runner yet — so the honest thing is to state
 * the lapse and not to pretend the stored state is something it is not.
 */
function status(collaboration: CampaignCollaboration, now: Date): string {
  const { state, respondBy } = collaboration;

  if (state === "invited") {
    if (respondBy === null) return "Waiting on the creator. No deadline was recorded.";
    const deadline = new Date(respondBy);
    if (now >= deadline) {
      return `The window to answer closed on ${format(deadline)}. Nothing has swept it yet, so it still reads as invited.`;
    }
    return `Waiting on the creator until ${format(deadline)}.`;
  }

  const waiting: Partial<Record<CollaborationState, string>> = {
    accepted: "Accepted. Drafting starts immediately.",
    drafting: "The creator is writing the draft.",
    in_review: "The draft is with you.",
    changes_requested: "Sent back with a note. Waiting on the creator.",
    approved: "Approved. Waiting for the creator to publish and paste the URL.",
    published: "Published. The measurement window is running.",
    completed: "Closed.",
    declined: "The creator declined.",
    expired: "The invitation expired unanswered.",
    cancelled: "Cancelled.",
  };

  return waiting[state] ?? "";
}

function format(at: Date): string {
  return at.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
