import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { MAX_RANK, MIN_RANK } from "@/lib/brand/icp-form";
import { loadIcpWorkbench } from "@/lib/brand/queries";
import { SUPPORTED_REGIONS } from "@/lib/geo/regions";
import { SENIORITY_LADDER } from "@/lib/taxonomy/seniority";
import { buildTaxonomyLookup } from "@/lib/score/labels";
import type { IcpTargets } from "@/lib/brand/intelligence";

import { IcpCard, type DimensionOptions } from "./icp-card";

export const metadata = { title: "Your ICPs" };

const EMPTY: IcpTargets = { job_function: [], seniority: [], industry: [], geo: [] };

/**
 * Step two of two, and the one that cannot be skipped (PRODUCT.md step 3).
 *
 * naano's screen with one difference, which is the whole enabling change: the
 * targets are editable chips rather than three paragraphs with theme chips
 * beside them. You cannot score against a paragraph, so the paragraph stays as
 * something to read and the chips are what the marketplace actually reads.
 *
 * It is also not a one-time screen. naano's own open question is whether the
 * ICP set is editable after onboarding (`recon/NOTES.md`); ours is, and this is
 * the same screen either way.
 */
export default async function IcpEditorPage() {
  const workbench = await loadIcpWorkbench();
  // No workspace means onboarding never happened. Step 2 comes before step 3.
  if (!workbench) redirect("/brand/setup");

  const { workspace, profile, icps, topics } = workbench;
  const taxonomy = buildTaxonomyLookup(topics);

  const options: DimensionOptions = {
    job_function: topics
      .filter((topic) => topic.kind === "function")
      .map((topic) => ({ value: topic.slug, label: topic.label })),
    seniority: SENIORITY_LADDER.map(([value, label]) => ({ value, label })),
    industry: topics
      .filter((topic) => topic.kind === "industry")
      .map((topic) => ({ value: topic.slug, label: topic.label })),
    geo: SUPPORTED_REGIONS.map((code) => ({ value: code, label: taxonomy.labelFor("geo", code) })),
  };

  const ranks = Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, index) => MIN_RANK + index);
  const byRank = new Map(icps.map((icp) => [icp.rank, icp]));
  const targeted = icps.filter(
    (icp) => icp.isActive && Object.values(icp.targets).some((values) => values.length > 0),
  ).length;

  return (
    <Page>
      <PageHeader
        title={`Who ${workspace.name} sells to`}
        description="Three ideal customers, as targets rather than prose. Every creator in the marketplace is scored by how much of their audience falls inside these — dimension by dimension, with the working shown. Get them wrong and the score is confidently wrong, which is worse than having none."
      />

      {profile ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{profile.companyName}</CardTitle>
            <CardMeta>
              {profile.source === "auto" ? "Generated from your website" : "Edited"}
              {profile.sizeBand ? ` · ${profile.sizeBand} people` : ""}
              {profile.industryId ? ` · ${taxonomy.labelForTopicId(profile.industryId)}` : ""}
            </CardMeta>
          </CardHeader>
          {profile.tagline || profile.valueProp ? (
            <CardBody>
              {profile.tagline ? <p className="text-md">{profile.tagline}</p> : null}
              {profile.valueProp ? (
                <p className="mt-1.5 max-w-prose text-sm text-pretty text-muted-foreground">
                  {profile.valueProp}
                </p>
              ) : null}
            </CardBody>
          ) : null}
        </Card>
      ) : (
        /* Generation did not run or did not produce one. Saying so beats a
           panel of placeholders that reads like a profile nobody wrote. */
        <Callout tone="empty" className="mt-6">
          There is no generated brand profile for {workspace.name}
          {workspace.website ? ` (${workspace.website})` : ""}. Nothing was invented
          to fill the gap, so the ICPs below are yours to write.
        </Callout>
      )}

      <div className="mt-6 space-y-4">
        {ranks.map((rank) => {
          const icp = byRank.get(rank);
          return (
            <IcpCard
              key={rank}
              rank={rank}
              id={icp?.id ?? null}
              label={icp?.label ?? ""}
              description={icp?.description ?? ""}
              isActive={icp?.isActive ?? true}
              targets={icp?.targets ?? EMPTY}
              options={options}
              generated={profile?.source === "auto" && icp !== undefined}
            />
          );
        })}
      </div>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {targeted === 0
            ? "No ICP has any targets yet, so the marketplace has nothing to score against and will say so rather than rank creators at zero."
            : `${targeted} of ${ranks.length} are active and have targets. Creators are scored against each one, and the marketplace shows the best.`}
        </p>
        <Button asChild size="lg">
          <Link href="/brand/creators">
            See who matches
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>
    </Page>
  );
}
