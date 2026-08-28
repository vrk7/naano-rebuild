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
    <section className="rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">The brief</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {MODE_LABEL[mode]}
        </span>
      </div>

      {body ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{body}</p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No body recorded.</p>
      )}

      <div className="mt-5 border-t border-border pt-4">
        {isVacuous(requirements) ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {mode === "creative_freedom"
              ? "No requirements, by definition. Every deterministic check passes and the creator writes it their way."
              : "A specific brief with nothing required. Every deterministic check passes vacuously, exactly as it would under creative freedom — the difference is that this one can have rules added to it."}
          </p>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Checked on submit
            </p>
            <dl className="mt-2 space-y-1.5">
              {lines.map((line) => (
                <div key={line.label} className="flex flex-wrap gap-x-2 text-sm">
                  <dt className="text-muted-foreground">{line.label}</dt>
                  <dd className="text-pretty">{line.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-pretty text-muted-foreground">
              Each of these runs against the draft when the creator submits it, and a
              failure has to cite the span it judged.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
