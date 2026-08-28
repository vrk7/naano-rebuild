import Link from "next/link";

import { formatCents, formatPercent } from "@/lib/posts/metrics";
import { loadPostSummaries } from "@/lib/posts/queries";

export const metadata = { title: "Posts — naano" };

export default async function PostsIndex() {
  const posts = await loadPostSummaries();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Published posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What each post cost, and what it actually brought in.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No published posts yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Creator</th>
                <th className="px-4 py-3 text-right font-medium">Engaged</th>
                <th className="px-4 py-3 text-right font-medium">In ICP</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Per engaged</th>
                <th className="px-4 py-3 text-right font-medium">Per ICP match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/brand/posts/${post.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {post.creatorName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {post.campaignName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {post.economics.engagedPeople}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {post.economics.matchedPeople}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {formatPercent(post.economics.matchRate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(post.economics.costCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(post.economics.costPerEngagedCents)}
                  </td>
                  {/* The column the product exists for. An em dash here means the
                      post reached people and none of them were the ones asked for. */}
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatCents(post.economics.costPerMatchedCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
