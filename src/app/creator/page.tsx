import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/callout";
import { Page, PageHeader } from "@/components/ui/page";
import { STATE_LABEL, needsAction } from "@/lib/collaboration/machine";
import { loadCreatorCollaborations } from "@/lib/collaboration/creator-inbox";
import { formatCents } from "@/lib/posts/metrics";

export const metadata = { title: "Collaborations" };

/**
 * The creator's inbox.
 *
 * "Needs you" is `needsAction`, the same derivation the brand side uses.
 * PRODUCT.md: one function, not two divergent inboxes — a row cannot be waiting
 * on the creator here and on nobody over there.
 */
export default async function CreatorHome() {
  // RLS limits this to collaborations whose creator_id resolves to this
  // session, so a creator sees their own bookings and nothing else.
  const collaborations = await loadCreatorCollaborations();
  const now = new Date();

  return (
    <Page>
      <PageHeader title="Collaborations" />

      {collaborations.length === 0 ? (
        <EmptyState title="Nothing here yet" className="mt-6">
          Collaborations appear once a brand books you.
        </EmptyState>
      ) : (
        <ul className="mt-6 space-y-2">
          {collaborations.map((collaboration) => {
            const respondBy = collaboration.respondBy ? new Date(collaboration.respondBy) : null;
            const lapsed =
              collaboration.state === "invited" && respondBy !== null && now >= respondBy;

            return (
              <li key={collaboration.id}>
                <Link
                  href={`/creator/collaborations/${collaboration.id}`}
                  className="block rounded-lg border border-border p-3.5 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    {/* The fee is the first thing a creator looks for, so it is
                        the row's headline and it is tabular — this is a list
                        that gets compared down the column. */}
                    <span className="num text-md font-medium tabular-nums">
                      {formatCents(collaboration.priceCents)} for one post
                    </span>
                    <span className="flex items-center gap-1.5">
                      {needsAction(collaboration.state, "creator") ? (
                        <Badge variant="accent">Needs you</Badge>
                      ) : null}
                      <Badge variant="neutral">{STATE_LABEL[collaboration.state]}</Badge>
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {collaboration.postBy ? `Post by ${collaboration.postBy}` : "No post date set"}
                    {collaboration.approvalRequired
                      ? " · the brand approves your draft"
                      : " · no approval needed"}
                  </p>

                  {collaboration.state === "invited" ? (
                    /* Nothing sweeps `invited` into `expired` — that transition
                       is the system's and has no runner yet — so a lapsed
                       invitation says so here rather than reading as open. */
                    <p className="mt-1 text-sm text-pretty">
                      {respondBy === null
                        ? "No deadline was set for answering this one."
                        : lapsed
                          ? `The window to answer closed on ${formatWhen(respondBy)}. You can still decline it.`
                          : `Answer by ${formatWhen(respondBy)}.`}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

function formatWhen(at: Date): string {
  return at.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
