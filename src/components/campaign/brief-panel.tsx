import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { describeRequirements, isVacuous, type BriefRequirements } from "@/lib/campaign/requirements";
import type { BriefMode } from "@/lib/campaign/parse";

const MODE_LABEL: Readonly<Record<BriefMode, string>> = {
  specific: "Specific brief",
  creative_freedom: "Creative freedom",
};

/**
 * The brief as both sides will read it: the prose, then the rules.
 *
 * The case worth getting right is the empty one. A specific brief with no
 * requirements set is allowed — PRODUCT.md is against fixing naano's dead end
 * "by ceremony" — but it must not look like a brief with rules, so the panel
 * says the checks pass vacuously rather than rendering an empty list and
 * leaving the reader to infer it.
 */
export function BriefPanel({
  mode,
  body,
  requirements,
}: {
  mode: BriefMode;
  body: string | null;
  requirements: BriefRequirements;
}) {
  const lines = describeRequirements(requirements);

  return (
    <Card>
      <CardHeader>
        <CardTitle>The brief</CardTitle>
        <Badge variant="neutral">{MODE_LABEL[mode]}</Badge>
      </CardHeader>

      <CardBody>
        {body ? (
          <p className="text-md whitespace-pre-line text-pretty leading-relaxed">{body}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No body recorded.</p>
        )}
      </CardBody>

      <div className="border-t border-border px-4 py-3.5">
        {isVacuous(requirements) ? (
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            {mode === "creative_freedom"
              ? "No requirements, by definition. Every deterministic check passes and the creator writes it their way."
              : "A specific brief with nothing required. Every deterministic check passes vacuously, exactly as it would under creative freedom — the difference is that this one can have rules added to it."}
          </p>
        ) : (
          <>
            <p className="eyebrow">Checked on submit</p>
            {/* A two-column grid rather than a wrapped run of dt/dd pairs: the
                labels are short and repetitive, so aligning them lets the rules
                themselves be read down the right-hand column. */}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {lines.map((line) => (
                <div key={line.label} className="col-span-2 grid grid-cols-subgrid">
                  <dt className="whitespace-nowrap text-muted-foreground">{line.label}</dt>
                  <dd className="text-pretty">{line.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 max-w-prose text-xs text-pretty text-muted-foreground">
              Each of these runs against the draft when the creator submits it, and a
              failure has to cite the span it judged.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
