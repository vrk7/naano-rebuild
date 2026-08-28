import Link from "next/link";
import { notFound } from "next/navigation";

import { AudiencePanel } from "@/components/creator/audience-panel";
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
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{creator.displayName}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This workspace has no active ICPs, so there is nothing to score this
          creator against.
        </p>
      </main>
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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href={campaign ? `/brand/campaigns/${campaign.id}/creators` : "/brand/creators"}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← {campaign ? `Creators for ${campaign.name}` : "All creators"}
      </Link>

      <header className="mt-4 flex flex-wrap items-start gap-6">
        <ScoreBadge score={selected.score} size="large" />

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{creator.displayName}</h1>
          {creator.headline ? (
            <p className="mt-1 text-sm text-muted-foreground">{creator.headline}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {creator.followers.toLocaleString()} followers
            {country ? ` · ${country}` : ""}
            {creator.priceCents !== null
              ? ` · ${formatCents(creator.priceCents)} per post`
              : " · no rate published"}
          </p>
          {creator.topics.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {creator.topics.map((topicId) => (
                <li
                  key={topicId}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {taxonomy.labelForTopicId(topicId)}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ConfidenceNote score={selected.score} />
            <span className="text-xs text-muted-foreground">
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
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={`/brand/campaigns/${campaign.id}/book/${creator.id}`}
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
          >
            Book on {campaign.name}
          </Link>
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

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {isWithheld ? "What a score would need" : "How the score was built"}
          </h2>
          <span className="text-sm text-muted-foreground">against {selected.icp.label}</span>
        </div>

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

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Who this audience is</h2>
          <span className="text-sm text-muted-foreground">
            Highlighted rows are the ones {selected.icp.label} asked for
          </span>
        </div>
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

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Recent posts</h2>
        {posts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No posts recorded for this creator. Posts land here once a collaboration
            with them is published.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {posts.map((post) => (
              <li key={post.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {post.isSponsored ? " · sponsored" : ""}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {post.impressions.toLocaleString()} impressions ·{" "}
                    {post.reactions.toLocaleString()} reactions ·{" "}
                    {post.comments.toLocaleString()} comments
                  </span>
                </div>
                {post.body ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed">{post.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
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
    <div className="mt-6 rounded-xl border border-border bg-muted/30 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {value === null ? "Why there is no score" : `Why this scores ${value}`}
      </p>
      <p className="mt-1.5 text-lg text-pretty">{headline}</p>
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
    <div className="mt-3 rounded-xl border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Where {campaignName} is running
      </p>
      <p className="mt-1 text-sm text-pretty">{detail}</p>
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
    <div className="mt-4 flex flex-wrap gap-2">
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
            className={
              isSelected
                ? "rounded-lg border border-foreground/20 bg-muted px-3 py-1.5 text-sm font-medium"
                : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50"
            }
          >
            {entry.icp.label}
            <span className="ml-2 border-l border-border pl-2 tabular-nums opacity-70">
              {value === null ? "n/a" : value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
