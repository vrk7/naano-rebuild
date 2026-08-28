/**
 * Loading and writing campaigns (PRODUCT.md step 4).
 *
 * Everything runs as the signed-in user. `campaign` and `brief` are both
 * workspace-scoped by RLS, so a campaign belonging to another workspace is
 * absent rather than filtered here, and the insert's WITH CHECK is what stops
 * one being created against a workspace the session does not belong to.
 */

import { createClient } from "@/lib/supabase/server";
import { parseStoredRequirements, type BriefRequirements } from "./requirements";
import { isBriefMode, type BriefMode, type CampaignInput } from "./parse";

export type CampaignSummary = {
  readonly id: string;
  readonly name: string;
  readonly objective: string | null;
  readonly status: string;
  readonly geos: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly briefMode: BriefMode | null;
  readonly requirementCount: number;
};

export type CampaignDetail = CampaignSummary & {
  readonly brief: {
    readonly mode: BriefMode;
    readonly body: string | null;
    readonly requirements: BriefRequirements;
  } | null;
  readonly collaborationCount: number;
};

const CAMPAIGN_SELECT = "id, name, objective, status, geos, created_at, brief ( mode, body, requirements )";

type RawBrief = { mode: string; body: string | null; requirements: unknown };
type RawCampaign = {
  id: string;
  name: string;
  objective: string | null;
  status: string;
  geos: string[] | null;
  created_at: string;
  brief: unknown;
};

/** `brief` is a 1:1 relation, which PostgREST may hand back as an object or a one-item array. */
function briefOf(value: unknown): RawBrief | null {
  if (Array.isArray(value)) return (value[0] as RawBrief) ?? null;
  return (value as RawBrief) ?? null;
}

/**
 * A stored `mode` outside the two we have is a broken row, not a third mode.
 * Returning null makes the caller say so rather than render a brief whose kind
 * it cannot name.
 */
function modeOf(raw: RawBrief | null): BriefMode | null {
  return raw && isBriefMode(raw.mode) ? raw.mode : null;
}

function summarise(row: RawCampaign): CampaignSummary {
  const raw = briefOf(row.brief);
  const requirements = raw ? parseStoredRequirements(raw.requirements) : {};

  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    geos: row.geos ?? [],
    createdAt: row.created_at,
    briefMode: modeOf(raw),
    requirementCount: Object.keys(requirements).length,
  };
}

export async function loadCampaigns(): Promise<CampaignSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaign")
    .select(CAMPAIGN_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load campaigns: ${error.message}`);
  if (!data) throw new Error("Campaign query returned no data");

  return (data as unknown as RawCampaign[]).map(summarise);
}

export async function loadCampaign(campaignId: string): Promise<CampaignDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaign")
    .select(CAMPAIGN_SELECT)
    .eq("id", campaignId)
    .maybeSingle();

  if (error) throw new Error(`Could not load campaign: ${error.message}`);
  // Absent means either no such campaign or one this workspace may not see. The
  // page renders a 404 for both; distinguishing them would leak its existence.
  if (!data) return null;

  const row = data as unknown as RawCampaign;
  const raw = briefOf(row.brief);
  const mode = modeOf(raw);

  const { count, error: countError } = await supabase
    .from("collaboration")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (countError) {
    throw new Error(`Could not count collaborations: ${countError.message}`);
  }

  return {
    ...summarise(row),
    brief:
      raw && mode
        ? { mode, body: raw.body, requirements: parseStoredRequirements(raw.requirements) }
        : null,
    collaborationCount: count ?? 0,
  };
}

/**
 * The workspace a campaign is created against.
 *
 * RLS returns only workspaces this session belongs to, and SCOPE.md cuts
 * multi-workspace switching, so there is exactly one. More than one would mean
 * the campaign form needs a picker it does not have — better to say so than to
 * silently write to whichever came back first.
 */
async function currentWorkspaceId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace").select("id").limit(2);

  if (error) throw new Error(`Could not find your workspace: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("This account does not belong to a workspace, so it cannot own a campaign.");
  }
  if (data.length > 1) {
    throw new Error(
      "This account belongs to more than one workspace, and the campaign form has no picker.",
    );
  }

  return data[0].id as string;
}

/**
 * Creates the campaign and its brief.
 *
 * Two inserts, because PostgREST has no cross-statement transaction. If the
 * brief fails the campaign is deleted again: a campaign with no brief is a
 * state nothing else in the product handles — step 5 books against a brief, and
 * the draft checks read `requirements` — and leaving one behind would put a
 * half-made row in the list with no way to finish it.
 */
export async function createCampaign(input: CampaignInput): Promise<string> {
  const supabase = await createClient();
  const workspaceId = await currentWorkspaceId();

  const { data: campaign, error } = await supabase
    .from("campaign")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      objective: input.objective,
      geos: input.geos,
      // `draft` exists in the enum for an editing flow that is not built. A
      // campaign is created complete, with its brief, and the next step is
      // booking against it — so it is live on arrival rather than needing a
      // button whose only purpose would be to flip this field.
      status: "live",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Could not create the campaign: ${error.message}`);

  const { error: briefError } = await supabase.from("brief").insert({
    campaign_id: campaign.id,
    mode: input.brief.mode,
    body: input.brief.body,
    requirements: input.brief.requirements,
  });

  if (briefError) {
    const { error: undoError } = await supabase.from("campaign").delete().eq("id", campaign.id);
    if (undoError) {
      throw new Error(
        `Could not save the brief (${briefError.message}), and the empty campaign could not be removed either (${undoError.message}).`,
      );
    }
    throw new Error(`Could not save the brief: ${briefError.message}`);
  }

  return campaign.id as string;
}
