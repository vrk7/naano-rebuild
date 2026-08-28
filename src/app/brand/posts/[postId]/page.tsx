import { notFound } from "next/navigation";

import { CompaniesTable } from "@/components/post/companies-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Metric, MetricRow } from "@/components/ui/metric";
import { BackLink, Page, PageHeader, SectionHeader } from "@/components/ui/page";
import { PeopleTable } from "@/components/post/people-table";
import { PostEconomicsPanel } from "@/components/post/post-economics-panel";
import { loadPostDetail } from "@/lib/posts/queries";

export default async function PostPage({ params }: PageProps<"/brand/posts/[postId]">) {
  const { postId } = await params;
  const post = await loadPostDetail(postId);

  // Also the answer when the post belongs to another workspace: RLS returns
  // nothing and the page cannot tell the difference, which is the point.
  if (!post) notFound();

  const published = new Date(post.publishedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Page width="wide">
      <BackLink href="/brand/posts">All posts</BackLink>

      <PageHeader
        className="mt-3"
        title={post.creator.name}
        description={`${post.creator.headline} · ${post.creator.followers.toLocaleString()} followers`}
      />
      <p className="mt-1 text-sm text-muted-foreground">
        {/* Not a link: the campaign page is not built yet, and a link to a 404
            is worse than plain text. */}
        Published {published} · {post.campaign.name}
      </p>

      <section className="mt-6 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_19rem]">
        <Card>
          <CardHeader>
            <CardTitle>The post</CardTitle>
          </CardHeader>
          <CardBody>
            {post.body ? (
              <p className="text-md whitespace-pre-line text-pretty leading-relaxed">
                {post.body}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No body recorded.</p>
            )}
          </CardBody>
          <MetricRow className="rounded-none rounded-b-lg border-x-0 border-b-0">
            <Metric label="Impressions" value={post.impressions.toLocaleString()} />
            <Metric label="Reactions" value={post.reactions.toLocaleString()} />
            <Metric label="Comments" value={post.comments.toLocaleString()} />
            <Metric label="Reposts" value={post.reposts.toLocaleString()} />
          </MetricRow>
        </Card>

        <PostEconomicsPanel economics={post.economics} />
      </section>

      <section className="mt-8">
        <SectionHeader
          title="People who engaged"
          meta={`${post.economics.engagedPeople} people · ${post.economics.matchedPeople} matching an ICP`}
          description="Simulated engagement. Every person here was generated from this creator’s audience snapshot, not scraped from LinkedIn."
        />
        <PeopleTable people={post.people} />
      </section>

      <section className="mt-8">
        <SectionHeader title="Companies" meta={`${post.companies.length} employers`} />
        <CompaniesTable companies={post.companies} />
      </section>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Written against</CardTitle>
          {post.brief ? (
            <Badge variant="neutral">
              {post.brief.mode === "creative_freedom" ? "Creative freedom" : "Specific brief"}
            </Badge>
          ) : null}
        </CardHeader>
        <CardBody>
          {post.brief?.body ? (
            <p className="text-md whitespace-pre-line text-pretty leading-relaxed">
              {post.brief.body}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No brief recorded.</p>
          )}

          {/* PRODUCT.md step 13 asks for a link back to the collaboration. The
              collaboration page belongs to a later step and does not exist, so
              this states what it can and stops short of a dead link. */}
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              Collaboration{" "}
              <span className="font-mono text-xs">{post.collaboration.id.slice(0, 8)}</span>
            </span>
            <Badge variant="outline">{post.collaboration.state}</Badge>
            {post.externalUrl ? (
              <a
                href={post.externalUrl}
                rel="noreferrer noopener"
                target="_blank"
                className="text-foreground underline underline-offset-4"
              >
                View on LinkedIn
              </a>
            ) : null}
          </p>
        </CardBody>
      </Card>
    </Page>
  );
}
