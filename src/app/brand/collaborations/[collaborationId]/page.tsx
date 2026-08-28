import { notFound } from "next/navigation";

import { BriefPanel } from "@/components/campaign/brief-panel";
import { DraftPanel } from "@/components/draft/draft-panel";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { BackLink, Page, SectionHeader } from "@/components/ui/page";
import { STATE_LABEL, needsAction, type CollaborationState } from "@/lib/collaboration/machine";
import { loadCollaboration, loadEvents, type CollaborationEvent } from "@/lib/collaboration/queries";
import { loadDrafts, loadPost } from "@/lib/draft/queries";
import { formatCents } from "@/lib/posts/metrics";

import { ReviewForm } from "./review-form";

export async function generateMetadata({
  params,
}: PageProps<"/brand/collaborations/[collaborationId]">) {
  const { collaborationId } = await params;
  const collaboration = await loadCollaboration(collaborationId);
  return { title: collaboration ? `${collaboration.creator.displayName}` : "Collaboration" };
}

/**
 * One booking, from the brand's side (PRODUCT.md step 10).
 *
 * The review screen, and the only place the draft and its check results are
 * read together. A brand approving a post without the rules it was written to
 * is guessing, so the brief is on the page rather than a click away.
 */
export default async function BrandCollaborationPage({
  params,
}: PageProps<"/brand/collaborations/[collaborationId]">) {
  const { collaborationId } = await params;
  const collaboration = await loadCollaboration(collaborationId);

  // Also the answer when the collaboration belongs to another workspace: RLS
  // returns nothing and the page cannot tell the difference, which is the point.
  if (!collaboration) notFound();

  const [drafts, post, events] = await Promise.all([
    loadDrafts(collaborationId),
    loadPost(collaborationId),
    loadEvents(collaborationId),
  ]);

  const [latest, ...previous] = drafts;
  const yourTurn = needsAction(collaboration.state, "brand");

  return (
    <Page>
      <BackLink href={`/brand/campaigns/${collaboration.campaign.id}`}>
        {collaboration.campaign.name}
      </BackLink>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-[-0.014em]">
            {collaboration.creator.displayName}
          </h1>
          {yourTurn ? <Badge variant="accent">Waiting on you</Badge> : null}
          <Badge variant="neutral">{STATE_LABEL[collaboration.state]}</Badge>
        </div>
        <p className="num mt-1.5 text-sm tabular-nums text-muted-foreground">
          {formatCents(collaboration.priceCents)} committed
          {collaboration.postBy ? ` · post by ${collaboration.postBy}` : ""}
          {collaboration.approvalRequired
            ? " · you approve the draft"
            : " · no approval needed"}
        </p>
      </header>

      <section className="mt-6">
        {/* What this is waiting on, said before the controls that resolve it. */}
        <h2 className="text-lg font-medium text-pretty">{headline(collaboration.state)}</h2>

        {collaboration.state === "in_review" && latest ? (
          <ReviewForm collaborationId={collaboration.id} />
        ) : null}

        {post ? (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block break-all text-sm underline underline-offset-4"
          >
            {post.externalUrl}
          </a>
        ) : null}
      </section>

      {latest ? (
        <div className="mt-6">
          <DraftPanel draft={latest} />
        </div>
      ) : (
        <Callout tone="empty" className="mt-6">
          Nothing has been submitted yet. The draft and its check results appear here
          the moment the creator submits — you see the same results they do.
        </Callout>
      )}

      {previous.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer rounded-md px-1 py-0.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25">
            {previous.length} earlier {previous.length === 1 ? "version" : "versions"}
          </summary>
          <div className="mt-3 space-y-3">
            {previous.map((draft) => (
              <DraftPanel key={draft.id} draft={draft} />
            ))}
          </div>
        </details>
      ) : null}

      <div className="mt-6">
        {collaboration.brief ? (
          <BriefPanel
            mode={collaboration.brief.mode}
            body={collaboration.brief.body}
            requirements={collaboration.brief.requirements}
          />
        ) : null}
      </div>

      <section className="mt-8">
        <SectionHeader title="History" meta={`${events.length} events`} />
        <History events={events} />
      </section>
    </Page>
  );
}

/**
 * The append-only log, rendered as what happened.
 *
 * `collaboration_event` is the history PRODUCT.md keeps rather than a status
 * field with amnesia, and this is the one screen that shows it: who moved the
 * collaboration, when, and what they said while doing it.
 */
function History({ events }: { events: ReadonlyArray<CollaborationEvent> }) {
  return (
    <ol className="space-y-2.5 border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          {/* The node on the rule. Without it the left border is decoration;
              with it the list reads as a sequence of discrete events. */}
          <span
            aria-hidden
            className="absolute top-1.5 -left-[1.3125rem] size-1.5 rounded-full bg-border ring-4 ring-background"
          />
          <p className="text-sm">
            <span className="font-medium">{STATE_LABEL[event.toState]}</span>
            <span className="num tabular-nums text-muted-foreground">
              {" · "}
              {event.actor}
              {" · "}
              {new Date(event.at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>
          {event.note ? (
            <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{event.note}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** What this collaboration is waiting on, in one line. */
function headline(state: CollaborationState): string {
  const lines: Readonly<Record<CollaborationState, string>> = {
    invited: "Waiting on the creator to answer.",
    accepted: "Accepted. Drafting starts immediately.",
    drafting: "The creator is writing the draft.",
    in_review: "Approve it, or send it back with a note.",
    changes_requested: "Sent back. Waiting on the creator.",
    approved: "Approved. Waiting for the creator to publish and paste the link.",
    published: "Published. The measurement window is running.",
    completed: "Closed.",
    declined: "The creator declined.",
    expired: "The invitation expired unanswered.",
    cancelled: "Cancelled.",
  };
  return lines[state];
}
