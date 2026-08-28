import Link from "next/link";
import { notFound } from "next/navigation";

import { CompaniesTable } from "@/components/post/companies-table";
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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/brand/posts"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← All posts
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{post.creator.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {post.creator.headline} · {post.creator.followers.toLocaleString()} followers
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {/* Not a link: the campaign page is not built yet, and a link to a 404
              is worse than plain text. */}
          Published {published} · {post.campaign.name}
        </p>
      </header>

      <section className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="rounded-lg border border-border p-5">
          <h2 className="text-sm font-medium">The post</h2>
          {post.body ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{post.body}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No body recorded.</p>
          )}

          <dl className="mt-5 grid grid-cols-4 gap-3 border-t border-border pt-4 text-center">
            {[
              ["Impressions", post.impressions],
              ["Reactions", post.reactions],
              ["Comments", post.comments],
              ["Reposts", post.reposts],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-base font-medium tabular-nums">
                  {Number(value).toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <PostEconomicsPanel economics={post.economics} />
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">People who engaged</h2>
          <span className="text-sm text-muted-foreground">
            {post.economics.engagedPeople} people · {post.economics.matchedPeople} matching an ICP
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulated engagement. Every person here was generated from this creator&rsquo;s
          audience snapshot, not scraped from LinkedIn.
        </p>
        <PeopleTable people={post.people} />
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Companies</h2>
          <span className="text-sm text-muted-foreground">
            {post.companies.length} employers
          </span>
        </div>
        <CompaniesTable companies={post.companies} />
      </section>

      <section className="mt-10 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Written against</h2>
        {post.brief ? (
          <>
            <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
              {post.brief.mode === "creative_freedom" ? "Creative freedom" : "Specific brief"}
            </p>
            {post.brief.body ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                {post.brief.body}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No brief recorded.</p>
        )}
        {/* PRODUCT.md step 13 asks for a link back to the collaboration. The
            collaboration page belongs to a later step and does not exist, so
            this states what it can and stops short of a dead link. */}
        <p className="mt-4 text-sm text-muted-foreground">
          Collaboration {post.collaboration.id.slice(0, 8)} · {post.collaboration.state}
          {post.externalUrl ? (
            <>
              {" · "}
              <a
                href={post.externalUrl}
                rel="noreferrer noopener"
                target="_blank"
                className="text-foreground underline underline-offset-4"
              >
                View on LinkedIn
              </a>
            </>
          ) : null}
        </p>
      </section>
    </main>
  );
}
