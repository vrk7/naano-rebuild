import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefPanel } from "@/components/campaign/brief-panel";
import { STATE_LABEL, type CollaborationState } from "@/lib/collaboration/machine";
import { loadCreatorCollaboration } from "@/lib/collaboration/creator-inbox";
import { formatCents } from "@/lib/posts/metrics";

import { RespondForm } from "./respond-form";

export const metadata = { title: "Collaboration" };

/**
 * One invitation, and the two answers to it (PRODUCT.md step 8).
 *
 * Everything a creator needs to decide is on this page: the price, the date it
 * has to be out by, who approves the draft, how long they have to answer, and
 * the brief itself. There is no third answer — SCOPE.md cuts counter-offers,
 * and adding states to the machine to negotiate would not test the thesis.
 */
export default async function CreatorCollaborationPage({
  params,
}: PageProps<"/creator/collaborations/[collaborationId]">) {
  const { collaborationId } = await params;
  const collaboration = await loadCreatorCollaboration(collaborationId);

  // Also the answer when the collaboration is somebody else's: RLS returns
  // nothing and the page cannot tell the difference, which is the point.
  if (!collaboration) notFound();

  const now = new Date();
  const respondBy = collaboration.respondBy ? new Date(collaboration.respondBy) : null;
  const lapsed = respondBy !== null && now >= respondBy;
  const isOpenInvitation = collaboration.state === "invited";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/creator"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Collaborations
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatCents(collaboration.priceCents)} for one post
          </h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {STATE_LABEL[collaboration.state]}
          </span>
        </div>
        {/* An absence a creator will look for, so it is stated rather than left
            blank: the campaign belongs to the brand's workspace and only the
            brief crosses to the creator. */}
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Nothing here names the brand. The campaign stays in their workspace; the
          brief is the part that crosses to you.
        </p>
      </header>

      <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-xl border border-border p-5 sm:grid-cols-2">
        <Term label="Price">{formatCents(collaboration.priceCents)}</Term>
        <Term label="Post by">{collaboration.postBy ?? "No date set"}</Term>
        <Term label="Answer by">
          {respondBy === null ? "No deadline set" : formatWhen(respondBy)}
        </Term>
        <Term label="Draft approval">
          {collaboration.approvalRequired
            ? "The brand reviews your draft before it goes out"
            : "No review — you publish once the checks pass"}
        </Term>
      </dl>

      <div className="mt-6">
        {collaboration.brief ? (
          <BriefPanel
            mode={collaboration.brief.mode}
            body={collaboration.brief.body}
            requirements={collaboration.brief.requirements}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-border p-5 text-sm text-pretty text-muted-foreground">
            This campaign has no readable brief, so there is nothing here to write
            against. Do not accept it until the brand fixes that.
          </p>
        )}
      </div>

      {isOpenInvitation ? (
        <section className="mt-8 border-t border-border pt-6">
          {lapsed ? (
            <p className="text-sm text-pretty">
              The window to answer closed on {formatWhen(respondBy!)}, so this can no
              longer be accepted. Declining still works and tells the brand where it
              stands.
            </p>
          ) : null}
          <RespondForm collaborationId={collaboration.id} canAccept={!lapsed} />
        </section>
      ) : (
        <section className="mt-8 border-t border-border pt-6">
          <p className="text-sm text-pretty text-muted-foreground">
            {AFTER_ANSWERING[collaboration.state]}
          </p>
        </section>
      )}
    </main>
  );
}

/**
 * What happens next, once there is nothing to answer.
 *
 * The drafting screens are step 9 and are not built. Saying so is better than a
 * button that does nothing or a page that just stops.
 */
const AFTER_ANSWERING: Readonly<Record<CollaborationState, string>> = {
  invited: "",
  accepted: "Accepted. Drafting starts immediately.",
  drafting:
    "Accepted — this is yours to write. The drafting screen is not built yet, so there is nothing to submit from here.",
  in_review: "Your draft is with the brand.",
  changes_requested: "The brand sent it back with a note.",
  approved: "Approved. Publish it and paste the URL back.",
  published: "Published. The measurement window is running.",
  completed: "Closed.",
  declined: "You declined this one.",
  expired: "This invitation expired unanswered.",
  cancelled: "The brand cancelled this booking.",
};

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-pretty">{children}</dd>
    </div>
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
