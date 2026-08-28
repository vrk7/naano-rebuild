/**
 * The workspace a brand lands in, and the ICPs it is scored by
 * (PRODUCT.md steps 2–3).
 *
 * Both writes are `rpc` calls. `workspace` and `workspace_member` have no
 * insert policy at all — if a session could write them, any account could join
 * any workspace, and every other policy keys off exactly that membership — and
 * an ICP's row and its whole target set have to change together or the score
 * reads a half-saved ICP. The functions' own comments carry the rest.
 */

import { createClient } from "@/lib/supabase/server";
import { loadTopics } from "@/lib/taxonomy/queries";
import type { TopicRow } from "@/lib/score/labels";
import type { ScoreDimension } from "@/lib/score/weights";
import type { BrandIntelligence, IcpTargets } from "./intelligence";
import type { IcpEdit } from "./icp-form";

export type Workspace = {
  readonly id: string;
  readonly name: string;
  readonly website: string | null;
};

/**
 * The one workspace this session belongs to, or null.
 *
 * SCOPE.md cuts multi-workspace switching. Two would mean every screen needs a
 * picker it does not have, so that is an error rather than a silent choice of
 * whichever came back first.
 */
export async function loadWorkspace(): Promise<Workspace | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("workspace").select("id, name, website").limit(2);

  if (error) throw new Error(`Could not load your workspace: ${error.message}`);
  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    throw new Error("This account belongs to more than one workspace, which nothing here supports.");
  }

  return {
    id: data[0].id as string,
    name: data[0].name as string,
    website: (data[0].website ?? null) as string | null,
  };
}

export type BrandProfile = {
  readonly companyName: string;
  readonly tagline: string | null;
  readonly valueProp: string | null;
  readonly industryId: string | null;
  readonly sizeBand: string | null;
  readonly source: string;
};

export async function loadBrandProfile(): Promise<BrandProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brand_profile")
    .select("company_name, tagline, value_prop, industry_id, size_band, source")
    .maybeSingle();

  if (error) throw new Error(`Could not load the brand profile: ${error.message}`);
  if (!data) return null;

  return {
    companyName: data.company_name as string,
    tagline: (data.tagline ?? null) as string | null,
    valueProp: (data.value_prop ?? null) as string | null,
    industryId: (data.industry_id ?? null) as string | null,
    sizeBand: (data.size_band ?? null) as string | null,
    source: data.source as string,
  };
}

export type EditableIcp = {
  readonly id: string;
  readonly rank: number;
  readonly label: string;
  readonly description: string;
  readonly isActive: boolean;
  /** Slugs and ISO codes throughout, including industry — never topic ids. */
  readonly targets: IcpTargets;
};

export type IcpWorkbench = {
  readonly workspace: Workspace;
  readonly profile: BrandProfile | null;
  readonly icps: ReadonlyArray<EditableIcp>;
  readonly topics: ReadonlyArray<TopicRow>;
};

const EMPTY_TARGETS: IcpTargets = {
  job_function: [],
  seniority: [],
  industry: [],
  geo: [],
};

/**
 * Every ICP a workspace has, active or not, with its targets in the vocabulary
 * the editor speaks.
 *
 * `icp_target.value` holds a topic id for the industry dimension; the form
 * carries slugs, so the mapping happens here and its mirror image happens in
 * `write_icp_targets`. An id with no topic behind it is dropped rather than
 * rendered — there is no chip to show for a topic that was deleted, and the
 * uuid itself would be worse than its absence.
 */
export async function loadIcpWorkbench(): Promise<IcpWorkbench | null> {
  const workspace = await loadWorkspace();
  if (!workspace) return null;

  const supabase = await createClient();
  const [topics, profile] = await Promise.all([loadTopics(), loadBrandProfile()]);
  const slugById = new Map(topics.map((topic) => [topic.id, topic.slug]));

  const { data, error } = await supabase
    .from("icp")
    .select("id, rank, label, description, is_active, icp_target ( dimension, value )")
    .order("rank", { ascending: true });

  if (error) throw new Error(`Could not load your ICPs: ${error.message}`);
  if (!data) throw new Error("ICP query returned no data");

  const icps = data.map((row) => {
    const targets: Record<ScoreDimension, string[]> = {
      job_function: [],
      seniority: [],
      industry: [],
      geo: [],
    };

    for (const target of (row.icp_target ?? []) as Array<{ dimension: string; value: string }>) {
      const dimension = target.dimension as ScoreDimension;
      const value = dimension === "industry" ? slugById.get(target.value) : target.value;
      if (value !== undefined) targets[dimension].push(value);
    }

    return {
      id: row.id as string,
      rank: row.rank as number,
      label: row.label as string,
      description: (row.description ?? "") as string,
      isActive: row.is_active as boolean,
      targets,
    };
  });

  return { workspace, profile, icps, topics };
}

export type WriteResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "refused"; readonly reason: string };

/** Refusals `create_brand_workspace` and `upsert_icp` raise, by their hint tag. */
const REFUSALS: Readonly<Record<string, string>> = {
  no_session: "Sign in again — this request carried no session.",
  already_in_workspace: "This account already belongs to a workspace.",
  no_name: "A workspace needs a name.",
  unknown_industry: "One of those industries is not in the taxonomy any more.",
  no_label: "Give this ICP a name.",
  bad_rank: "An ICP is ranked 1, 2 or 3.",
  rank_taken: "Another ICP already holds that rank.",
  not_found: "That ICP is not one you can edit.",
  no_workspace: "This account does not belong to a workspace yet.",
};

function refusalFor(hint: string | null | undefined): string | null {
  if (!hint) return null;
  return REFUSALS[hint] ?? null;
}

export type NewWorkspace = {
  readonly name: string;
  readonly website: string;
  /** Null when generation did not produce one; the workspace is still created. */
  readonly intelligence: BrandIntelligence | null;
};

export async function createBrandWorkspace(input: NewWorkspace): Promise<WriteResult<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_brand_workspace", {
    p_name: input.name,
    p_website: input.website,
    p_profile: input.intelligence ? input.intelligence.profile : null,
    // Rank is the order they came back in: PRODUCT.md ranks 1..3 and the first
    // is the segment the site is most clearly written for.
    p_icps: input.intelligence
      ? input.intelligence.icps.map((icp, index) => ({ ...icp, rank: index + 1 }))
      : [],
  });

  if (error) {
    const refusal = refusalFor(error.hint);
    if (refusal) return { kind: "refused", reason: refusal };
    throw new Error(`Could not create your workspace: ${error.message}`);
  }

  if (typeof data !== "string") throw new Error("Workspace creation returned no id.");
  return { kind: "ok", value: data };
}

export async function saveIcp(edit: IcpEdit): Promise<WriteResult<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("upsert_icp", {
    p_icp_id: edit.id,
    p_rank: edit.rank,
    p_label: edit.label,
    p_description: edit.description,
    p_is_active: edit.isActive,
    p_targets: { ...EMPTY_TARGETS, ...edit.targets },
  });

  if (error) {
    const refusal = refusalFor(error.hint);
    if (refusal) return { kind: "refused", reason: refusal };
    throw new Error(`Could not save that ICP: ${error.message}`);
  }

  if (typeof data !== "string") throw new Error("Saving that ICP returned no id.");
  return { kind: "ok", value: data };
}
