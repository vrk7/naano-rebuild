import Link from "next/link";

import { EmptyState } from "@/components/ui/callout";
import { Page, PageHeader } from "@/components/ui/page";
import {
  TableFrame,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  CellNote,
} from "@/components/ui/table";
import { formatCents, formatPercent } from "@/lib/posts/metrics";
import { loadPostSummaries } from "@/lib/posts/queries";

export const metadata = { title: "Posts — naano" };

export default async function PostsIndex() {
  const posts = await loadPostSummaries();

  return (
    <Page width="wide">
      <PageHeader
        title="Published posts"
        description="What each post cost, and what it actually brought in."
      />

      {posts.length === 0 ? (
        <EmptyState title="No published posts yet" className="mt-6">
          A post appears here once a booked creator publishes their approved draft.
        </EmptyState>
      ) : (
        <TableFrame className="mt-6">
          <Table>
            <THead>
              <TR>
                <TH>Creator</TH>
                <TH numeric>Engaged</TH>
                <TH numeric>In ICP</TH>
                <TH numeric>Cost</TH>
                <TH numeric>Per engaged</TH>
                <TH numeric>Per ICP match</TH>
              </TR>
            </THead>
            <TBody>
              {posts.map((post) => (
                <TR key={post.id} interactive>
                  <TD>
                    <Link
                      href={`/brand/posts/${post.id}`}
                      className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                    >
                      {post.creatorName}
                    </Link>
                    <CellNote>{post.campaignName}</CellNote>
                  </TD>
                  <TD numeric>{post.economics.engagedPeople.toLocaleString()}</TD>
                  <TD numeric>
                    {post.economics.matchedPeople.toLocaleString()}
                    <CellNote>{formatPercent(post.economics.matchRate)}</CellNote>
                  </TD>
                  <TD numeric>{formatCents(post.economics.costCents)}</TD>
                  <TD numeric>{formatCents(post.economics.costPerEngagedCents)}</TD>
                  {/* The column the product exists for. An em dash here means the
                      post reached people and none of them were the ones asked for. */}
                  <TD numeric className="font-medium">
                    {formatCents(post.economics.costPerMatchedCents)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableFrame>
      )}
    </Page>
  );
}
