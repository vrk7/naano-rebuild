import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefPanel } from "@/components/campaign/brief-panel";
import { DraftPanel } from "@/components/draft/draft-panel";
import { STATE_LABEL, type CollaborationState } from "@/lib/collaboration/machine";
import { loadCreatorCollaboration } from "@/lib/collaboration/creator-inbox";
import { latestChangeNote, loadEvents } from "@/lib/collaboration/queries";
import { loadDrafts, loadPost, type DraftVersion } from "@/lib/draft/queries";
import { formatCents } from "@/lib/posts/metrics";

import { DraftForm } from "./draft-form";
import { PublishForm } from "./publish-form";
import { RespondForm } from "./respond-form";

export const metadata = { title: "Collaboration" };

/**
 * One collaboration, from the creator's side (PRODUCT.md steps 8 to 11).
 *
 * Everything they need to decide, then everything they need to do: the terms
 * and the brief, then whichever of answering, writing, revising and publishing
 * the state machine says is theirs right now. There is only ever one action on
 * screen, because `needsAction` only ever names one side at a time.
 */
export default async function CreatorCollaborationPage({
  params,
}: PageProps<"/creator/collaborations/[collaborationId]">) {
  const { collaborationId } = await params;
  const collaboration = await loadCreatorCollaboration(collaborationId);

  // Also the answer when the collaboration is somebody else's: RLS returns
  // nothing and the page cannot tell the difference, which is the point.
  if (!collaboration) notFound();

  const [drafts, post, events] = await Promise.all([
    loadDrafts(collaborationId),
    loadPost(collaborationId),
    loadEvents(collaborationId),
  ]);

  const now = new Date();
  const respondBy = collaboration.respondBy ? new Date(collaboration.respondBy) : null;
  const lapsed = respondBy !== null && now >= respondBy;
  const [latest] = drafts;

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

      <section className="mt-8 border-t border-border pt-6">
        {collaboration.state === "invited" ? (
          <>
            {lapsed ? (
              <p className="text-sm text-pretty">
                The window to answer closed on {formatWhen(respondBy!)}, so this can no
                longer be accepted. Declining still works and tells the brand where it
                stands.
              </p>
            ) : null}
            <RespondForm collaborationId={collaboration.id} canAccept={!lapsed} />
          </>
        ) : (
          <Work
            collaborationId={collaboration.id}
            state={collaboration.state}
            drafts={drafts}
            postUrl={post?.externalUrl ?? null}
            changeNote={latestChangeNote(events)?.note ?? null}
          />
        )}
      </section>

      {latest && collaboration.state !== "in_review" && collaboration.state !== "drafting" &&
      collaboration.state !== "changes_requested" ? (
        <div className="mt-6">
          <DraftPanel draft={latest} />
        </div>
      ) : null}
    </main>
  );
}

/**
 * Whatever is the creator's to do next.
 *
 * Driven by `state` alone, which is what makes it the same answer as the
 * "Needs you" marker on the list: PRODUCT.md derives both from one function
 * rather than keeping two inboxes that can disagree.
 */
function Work({
  collaborationId,
  state,
  drafts,
  postUrl,
  changeNote,
}: {
  collaborationId: string;
  state: CollaborationState;
  drafts: ReadonlyArray<DraftVersion>;
  postUrl: string | null;
  changeNote: string | null;
}) {
  const [latest] = drafts;

  if (state === "drafting" || state === "changes_requested") {
    return (
      <div>
        <h2 className="text-sm font-medium">
          {state === "changes_requested" ? "The brand sent it back" : "Write the post"}
        </h2>

        {state === "changes_requested" && changeNote ? (
          <blockquote className="mt-3 border-l-2 border-border pl-4 text-sm text-pretty">
            {changeNote}
          </blockquote>
        ) : null}

        {latest ? (
          <div className="mt-4">
            <DraftPanel draft={latest} title={`What you submitted (version ${latest.version})`} />
          </div>
        ) : null}

        <DraftForm
          collaborationId={collaborationId}
          previousBody={latest?.body ?? ""}
          isRevision={latest !== undefined}
        />
      </div>
    );
  }

  if (state === "approved") {
    return (
      <div>
        <h2 className="text-sm font-medium">Publish it</h2>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Approved. Post it on LinkedIn and paste the link back — everything the brand
          sees afterwards hangs off that link.
        </p>
        <PublishForm collaborationId={collaborationId} />
      </div>
    );
  }

  if (state === "published" || state === "completed") {
    return (
      <div>
        <h2 className="text-sm font-medium">
          {state === "published" ? "Published" : "Closed"}
        </h2>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          {state === "published"
            ? "The measurement window is running."
            : "The measurement window has closed."}
        </p>
        {postUrl ? (
          <a
            href={postUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block break-all text-sm underline underline-offset-4"
          >
            {postUrl}
          </a>
        ) : null}
      </div>
    );
  }

  return <p className="text-sm text-pretty text-muted-foreground">{AFTER_ANSWERING[state]}</p>;
}

/**
 * The states where nothing is the creator's to do.
 *
 * `in_review` is the one that matters: it is the brand's turn, and saying so
 * beats a screen that just stops.
 */
const AFTER_ANSWERING: Readonly<Record<CollaborationState, string>> = {
  invited: "",
  accepted: "Accepted. Drafting starts immediately.",
  drafting: "",
  in_review: "Your draft is with the brand. Nothing to do until they answer.",
  changes_requested: "",
  approved: "",
  published: "",
  completed: "",
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
