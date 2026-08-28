import Link from "next/link";

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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Collaborations</h1>

      {collaborations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing here yet. Collaborations appear once a brand books you.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {collaborations.map((collaboration) => {
            const respondBy = collaboration.respondBy ? new Date(collaboration.respondBy) : null;
            const lapsed =
              collaboration.state === "invited" && respondBy !== null && now >= respondBy;

            return (
              <li key={collaboration.id}>
                <Link
                  href={`/creator/collaborations/${collaboration.id}`}
                  className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-medium">
                      {formatCents(collaboration.priceCents)} for one post
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      {needsAction(collaboration.state, "creator") ? (
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
                          Needs you
                        </span>
                      ) : null}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        {STATE_LABEL[collaboration.state]}
                      </span>
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
    </main>
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
