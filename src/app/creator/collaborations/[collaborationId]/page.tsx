import { notFound } from "next/navigation";

import { BriefPanel } from "@/components/campaign/brief-panel";
import { DraftPanel } from "@/components/draft/draft-panel";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { BackLink, Page } from "@/components/ui/page";
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
    <Page width="narrow">
      <BackLink href="/creator">Collaborations</BackLink>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="num text-2xl font-semibold tracking-[-0.014em] tabular-nums">
            {formatCents(collaboration.priceCents)} for one post
          </h1>
          <Badge variant="neutral">{STATE_LABEL[collaboration.state]}</Badge>
        </div>
        {/* An absence a creator will look for, so it is stated rather than left
            blank: the campaign belongs to the brand's workspace and only the
            brief crosses to the creator. */}
        <p className="mt-1.5 max-w-prose text-sm text-pretty text-muted-foreground">
          Nothing here names the brand. The campaign stays in their workspace; the
          brief is the part that crosses to you.
        </p>
      </header>

      <dl className="mt-5 grid gap-x-6 gap-y-3 rounded-lg border border-border px-4 py-3.5 sm:grid-cols-2">
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
          <Callout tone="warning">
            This campaign has no readable brief, so there is nothing here to write
            against. Do not accept it until the brand fixes that.
          </Callout>
        )}
      </div>

      <section className="mt-6 border-t border-border pt-5">
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

      {/* Everywhere except the two states where `Work` already shows the draft
          it is asking you to rewrite. In review especially: PRODUCT.md has the
          creator see the failures before the brand does, and a screen that
          hides them the moment it is the brand's turn would make that untrue
          for the only period it matters. */}
      {latest &&
      collaboration.state !== "drafting" &&
      collaboration.state !== "changes_requested" ? (
        <div className="mt-5">
          <DraftPanel draft={latest} />
        </div>
      ) : null}
    </Page>
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
        <h2 className="text-lg font-medium">
          {state === "changes_requested" ? "The brand sent it back" : "Write the post"}
        </h2>

        {/* The brand's note is the only thing the creator gets, so it is set
            apart from the page rather than run in as another paragraph. */}
        {state === "changes_requested" && changeNote ? (
          <blockquote className="text-md mt-3 border-l-2 border-brand/40 bg-brand-soft/50 py-2 pl-4 text-pretty">
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
        <h2 className="text-lg font-medium">Publish it</h2>
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
        <h2 className="text-lg font-medium">
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
      <dt className="eyebrow">{label}</dt>
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
