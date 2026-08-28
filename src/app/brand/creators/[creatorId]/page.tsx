import Link from "next/link";
import { notFound } from "next/navigation";

import { AudiencePanel } from "@/components/creator/audience-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { BackLink, Page, PageHeader, SectionHeader } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { ScoreBreakdown } from "@/components/creator/score-breakdown";
import { ConfidenceNote, ScoreBadge } from "@/components/marketplace/score-badge";
import { formatCents } from "@/lib/posts/metrics";
import { loadCampaign } from "@/lib/campaign/queries";
import { loadCreatorProfile } from "@/lib/marketplace/queries";
import { quotableValue } from "@/lib/score/creator";
import type { IcpScore } from "@/lib/marketplace/ranking";
import type { CreatorProfile } from "@/lib/marketplace/queries";

export async function generateMetadata({ params }: PageProps<"/brand/creators/[creatorId]">) {
  const { creatorId } = await params;
  const profile = await loadCreatorProfile(creatorId);
  return { title: profile?.creator.displayName ?? "Creator" };
}

export default async function CreatorProfilePage({
  params,
  searchParams,
}: PageProps<"/brand/creators/[creatorId]">) {
  const { creatorId } = await params;
  const query = await searchParams;

  /*
   * The profile is not nested under a campaign, unlike the list.
   *
   * Its content genuinely does not depend on one: the breakdown, the audience
   * and every score read the workspace's ICPs. The campaign is carried as
   * context so the back link returns where you came from and the reach line can
   * answer the campaign's own question — not because the page is scoped.
   */
  const campaignId = Array.isArray(query.campaign) ? query.campaign[0] : query.campaign;
  const campaign = typeof campaignId === "string" ? await loadCampaign(campaignId) : null;

  const profile = await loadCreatorProfile(
    creatorId,
    campaign ? { campaignGeos: campaign.geos } : undefined,
  );

  if (!profile) notFound();

  const { creator, snapshot, scores, best, posts, taxonomy } = profile;

  if (best === null) {
    return (
      <Page>
        <PageHeader title={creator.displayName} />
        <Callout tone="empty" className="mt-6">
          This workspace has no active ICPs, so there is nothing to score this
          creator against.
        </Callout>
      </Page>
    );
  }

  // The ICP whose working is on screen. Defaults to the one the marketplace card
  // spoke for, so opening a creator shows the reasoning behind the number that
  // brought you here rather than a different one.
  const requested = Array.isArray(query.icp) ? query.icp[0] : query.icp;
  const selected = scores.find((entry) => entry.icp.id === requested) ?? best;
  const icp = profile.icps.find((entry) => entry.id === selected.icp.id)!;

  const isWithheld = quotableValue(selected.score) === null;
  const country = creator.country ? taxonomy.labelFor("geo", creator.country) : null;
  const captured = new Date(snapshot.capturedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Page width="wide">
      <BackLink
        href={campaign ? `/brand/campaigns/${campaign.id}/creators` : "/brand/creators"}
      >
        {campaign ? `Creators for ${campaign.name}` : "All creators"}
      </BackLink>

      <header className="mt-3 flex flex-wrap items-start gap-5">
        <ScoreBadge score={selected.score} size="large" />

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-[-0.014em]">{creator.displayName}</h1>
          {creator.headline ? (
            <p className="text-md mt-0.5 text-muted-foreground">{creator.headline}</p>
          ) : null}
          <p className="num mt-1 text-sm tabular-nums text-muted-foreground">
            {creator.followers.toLocaleString()} followers
            {country ? ` · ${country}` : ""}
            {creator.priceCents !== null
              ? ` · ${formatCents(creator.priceCents)} per post`
              : " · no rate published"}
          </p>
          {creator.topics.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {creator.topics.map((topicId) => (
                <li key={topicId}>
                  <Badge variant="outline">{taxonomy.labelForTopicId(topicId)}</Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <ConfidenceNote score={selected.score} />
            <span className="num text-xs tabular-nums text-muted-foreground">
              {creator.sampleSize.toLocaleString()} people observed across{" "}
              {creator.postsAnalyzed} posts · snapshot {captured}
            </span>
          </div>
        </div>
      </header>

      {/* The single largest detractor, in words, above the table. PRODUCT.md:
          "A brand should be able to read why a creator scored 31 without opening
          anything." */}
      <Verdict entry={selected} sampleSize={creator.sampleSize} postsAnalyzed={creator.postsAnalyzed} />

      {campaign && profile.campaignReach ? (
        <CampaignReachNote
          reach={profile.campaignReach}
          campaignName={campaign.name}
          regions={campaign.geos.map((code) => taxonomy.labelFor("geo", code))}
        />
      ) : null}

      {campaign ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button asChild size="lg">
            <Link href={`/brand/campaigns/${campaign.id}/book/${creator.id}`}>
              Book on {campaign.name}
            </Link>
          </Button>
          <span className="text-xs text-pretty text-muted-foreground">
            Price, the date it has to go out by, and whether you approve the draft.
          </span>
        </div>
      ) : (
        /* No campaign, no booking. A price with no brief behind it is the dead
           end at `brand/14` that PRODUCT.md puts the campaign before the
           marketplace to fix. */
        <p className="mt-6 text-sm text-pretty text-muted-foreground">
          Open this creator from a campaign to book them — an offer is made against
          a brief, not on its own.
        </p>
      )}

      <section className="mt-8">
        <SectionHeader
          title={isWithheld ? "What a score would need" : "How the score was built"}
          meta={`against ${selected.icp.label}`}
        />

        <IcpTabs creatorId={creator.id} scores={scores} selectedId={selected.icp.id} />

        {icp.description ? (
          <p className="mt-3 text-sm text-pretty text-muted-foreground">{icp.description}</p>
        ) : null}

        <ScoreBreakdown
          score={selected.score}
          taxonomy={taxonomy}
          sampleSize={creator.sampleSize}
          postsAnalyzed={creator.postsAnalyzed}
        />

        {isWithheld ? null : (
        <p className="mt-3 text-xs text-pretty text-muted-foreground">
          Weights are a stated guess, not a measurement — they encode an opinion
          that who the audience is matters slightly more than where it is, and they
          get calibrated against the first campaign with real outcomes.
        </p>
        )}
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Who this audience is"
          meta={`Highlighted rows are the ones ${selected.icp.label} asked for`}
        />
        <AudiencePanel
          facets={snapshot.facets}
          targets={icp.targets}
          taxonomy={taxonomy}
          showOverlap={!isWithheld}
        />
        {snapshot.source === "seed" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Seeded audience data. Generated for the demo workspace, not scraped from
            LinkedIn.
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <SectionHeader title="Recent posts" meta={posts.length > 0 ? `${posts.length}` : undefined} />
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No posts recorded for this creator. Posts land here once a collaboration
            with them is published.
          </p>
        ) : (
          <ul className="space-y-2">
            {posts.map((post) => (
              <li key={post.id} className="rounded-lg border border-border p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="num text-xs tabular-nums text-muted-foreground">
                    {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {post.isSponsored ? " · sponsored" : ""}
                  </span>
                  <span className="num text-xs tabular-nums text-muted-foreground">
                    {post.impressions.toLocaleString()} impressions ·{" "}
                    {post.reactions.toLocaleString()} reactions ·{" "}
                    {post.comments.toLocaleString()} comments
                  </span>
                </div>
                {post.body ? (
                  <p className="mt-2 line-clamp-3 text-sm text-pretty leading-relaxed">
                    {post.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

/**
 * The sentence above the table.
 *
 * At low confidence it refuses rather than reporting the detractor, for the same
 * reason the badge withholds the number: a percentage drawn from 40 people is
 * quotable whether or not it appears next to a score.
 */
function Verdict({
  entry,
  sampleSize,
  postsAnalyzed,
}: {
  entry: IcpScore;
  sampleSize: number;
  postsAnalyzed: number;
}) {
  const { score, icp } = entry;

  const headline = (() => {
    if (score.kind === "unscoreable") {
      return `${icp.label} has no targets set, so there is nothing to score against.`;
    }
    if (score.confidence === "low") {
      return `Not enough data. ${sampleSize.toLocaleString()} people across ${postsAnalyzed} posts is too thin a sample to put a number on.`;
    }
    if (score.largestDetractor === null) {
      return "Every dimension of this audience falls inside your targets.";
    }
    return `${score.largestDetractor}.`;
  })();

  const value = quotableValue(score);

  return (
    <div className="mt-5 rounded-lg border border-border bg-muted/50 px-4 py-3.5">
      <p className="eyebrow">
        {value === null ? "Why there is no score" : `Why this scores ${value}`}
      </p>
      {/* The one sentence the whole page is built to produce, so it is the
          largest text on the screen after the figure itself. */}
      <p className="mt-1 max-w-prose text-lg text-pretty">{headline}</p>
    </div>
  );
}

/**
 * Campaign reach, kept separate from the score.
 *
 * The score answers "does this creator reach the people you sell to". This
 * answers "does this creator reach where this campaign is running". They are
 * different questions with different answers, and a brand that sees a strong
 * score next to near-zero reach has learned something a single number would
 * have hidden.
 */
function CampaignReachNote({
  reach,
  campaignName,
  regions,
}: {
  reach: NonNullable<CreatorProfile["campaignReach"]>;
  campaignName: string;
  regions: ReadonlyArray<string>;
}) {
  if (reach.kind === "untargeted") return null;

  const detail =
    reach.kind === "unobserved"
      ? "This snapshot carries no region data, so we cannot say."
      : reach.share === 0
        ? `None of this audience is in ${regions.join(", ")}.`
        : `${Math.round(reach.share * 100)}% of this audience is in ${regions.join(", ")}.`;

  return (
    <div className="mt-2.5 rounded-lg border border-border px-4 py-3">
      <p className="eyebrow">Where {campaignName} is running</p>
      <p className="text-md mt-1 text-pretty">{detail}</p>
    </div>
  );
}

/**
 * One tab per active ICP, each carrying its own score.
 *
 * Server-rendered links rather than client state: the selected ICP belongs in
 * the URL so a brand can send someone "this creator, against our primary ICP"
 * and have it open on the same working.
 */
function IcpTabs({
  creatorId,
  scores,
  selectedId,
}: {
  creatorId: string;
  scores: ReadonlyArray<IcpScore>;
  selectedId: string;
}) {
  if (scores.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {scores.map((entry) => {
        const value = quotableValue(entry.score);
        const isSelected = entry.icp.id === selectedId;

        return (
          <Link
            key={entry.icp.id}
            href={`/brand/creators/${creatorId}?icp=${entry.icp.id}`}
            aria-current={isSelected ? "true" : undefined}
            title={
              value === null
                ? `Not enough data to score against ${entry.icp.label}`
                : `Scores ${value} out of 100 against ${entry.icp.label}`
            }
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
              isSelected
                ? "border-brand/30 bg-brand-soft font-medium text-brand"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {entry.icp.label}
            <span
              className={cn(
                "num ml-2 border-l pl-2 tabular-nums",
                isSelected ? "border-brand/25" : "border-border",
              )}
            >
              {value === null ? "n/a" : value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
