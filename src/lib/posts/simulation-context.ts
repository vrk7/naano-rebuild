import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { StoredFacet } from "./audience-distribution";
import type { ScoreDimension } from "@/lib/score/weights";

/**
 * Everything one simulation run reads before it writes anything.
 *
 * Split from the writing half so each stays readable. The thing worth noticing
 * is that every query names its workspace or its creator explicitly: this runs
 * on the service-role client, so the scoping RLS gives every other query in the
 * app for free has to be spelled out by hand here.
 */

export type Client = ReturnType<typeof createAdminClient>;

export type PostRow = {
  readonly id: string;
  readonly creatorPostId: string;
  readonly publishedAt: Date;
};

export type IcpWithTargets = {
  readonly id: string;
  readonly targets: Readonly<Partial<Record<ScoreDimension, ReadonlyArray<string>>>>;
};

export type Context =
  | {
      readonly kind: "ok";
      readonly post: PostRow;
      readonly creator: { readonly followers: number };
      readonly facets: ReadonlyArray<StoredFacet>;
      readonly icps: ReadonlyArray<IcpWithTargets>;
    }
  | { readonly kind: "refused"; readonly reason: string };

export async function loadContext(
  client: Client,
  collaborationId: string,
): Promise<Context> {
  const { data: collaboration, error: collaborationError } = await client
    .from("collaboration")
    .select("id, creator_id, workspace_id")
    .eq("id", collaborationId)
    .maybeSingle();
  if (collaborationError) {
    throw new Error(`Could not load the collaboration: ${collaborationError.message}`);
  }
  if (!collaboration) return { kind: "refused", reason: "That collaboration does not exist." };

  const { data: post, error: postError } = await client
    .from("post")
    .select("id, creator_post_id, published_at")
    .eq("collaboration_id", collaborationId)
    .maybeSingle();
  if (postError) throw new Error(`Could not load the post: ${postError.message}`);
  if (!post) {
    return { kind: "refused", reason: "That collaboration has no post recorded yet." };
  }

  const { data: creator, error: creatorError } = await client
    .from("creator")
    .select("followers")
    .eq("id", collaboration.creator_id)
    .maybeSingle();
  if (creatorError) throw new Error(`Could not load the creator: ${creatorError.message}`);
  if (!creator) return { kind: "refused", reason: "That creator no longer exists." };

  // The most recent snapshot — the same row the match score reads.
  const { data: snapshot, error: snapshotError } = await client
    .from("audience_snapshot")
    .select("id")
    .eq("creator_id", collaboration.creator_id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotError) throw new Error(`Could not load the snapshot: ${snapshotError.message}`);
  if (!snapshot) {
    return {
      kind: "refused",
      reason:
        "This creator has no audience snapshot, so there is nothing to draw engagement from.",
    };
  }

  const { data: facets, error: facetError } = await client
    .from("audience_facet")
    .select("dimension, value, share")
    .eq("snapshot_id", snapshot.id);
  if (facetError) throw new Error(`Could not load audience facets: ${facetError.message}`);

  const { data: icpRows, error: icpError } = await client
    .from("icp")
    .select("id, icp_target ( dimension, value )")
    .eq("workspace_id", collaboration.workspace_id)
    .eq("is_active", true);
  if (icpError) throw new Error(`Could not load ICPs: ${icpError.message}`);

  const icps: IcpWithTargets[] = (icpRows ?? []).map((row) => {
    const targets: Partial<Record<ScoreDimension, string[]>> = {};
    for (const target of (row.icp_target ?? []) as Array<{ dimension: string; value: string }>) {
      const dimension = target.dimension as ScoreDimension;
      (targets[dimension] ??= []).push(target.value);
    }
    return { id: row.id as string, targets };
  });

  return {
    kind: "ok",
    post: {
      id: post.id as string,
      creatorPostId: post.creator_post_id as string,
      publishedAt: new Date(post.published_at as string),
    },
    creator: { followers: (creator.followers as number) ?? 0 },
    facets: (facets ?? []) as StoredFacet[],
    icps,
  };
}
