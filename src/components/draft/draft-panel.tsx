import type { DraftVersion, StoredCheck } from "@/lib/draft/queries";

/**
 * One submitted draft, with what the checks said about it.
 *
 * The same panel on both sides. PRODUCT.md has the creator see the failures
 * before the brand does, which is a property of when the checks are written,
 * not of who gets a different screen — showing the brand a softer version of
 * the same verdict would be the marketplace's constant-100 problem in another
 * costume.
 */
export function DraftPanel({
  draft,
  title,
}: {
  draft: DraftVersion;
  title?: string;
}) {
  const failed = draft.checks.filter((check) => check.status === "fail");

  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{title ?? `Draft, version ${draft.version}`}</h2>
        <span className="text-xs text-muted-foreground">
          Submitted{" "}
          {new Date(draft.submittedAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          {draft.body.length.toLocaleString()} characters
        </span>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{draft.body}</p>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {draft.checks.length === 0
            ? "Checked on submit"
            : failed.length === 0
              ? `Checked on submit · all ${draft.checks.length} passed`
              : `Checked on submit · ${failed.length} of ${draft.checks.length} failed`}
        </p>
        <CheckList checks={draft.checks} />
      </div>
    </section>
  );
}

/**
 * The checks, failures first.
 *
 * Each row says what the rule was, what the verdict is, and — where the finding
 * points at the draft — the span it judged. A failure with no span is an
 * absence: there is nothing to quote for a link that is not there, and quoting
 * the opening line instead would be evidence for a claim it is not evidence for.
 */
export function CheckList({ checks }: { checks: ReadonlyArray<StoredCheck> }) {
  if (checks.length === 0) {
    return (
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        This brief sets no requirements, so there was nothing to check. Every rule
        passes vacuously — which is what creative freedom means, not a check that
        failed to run.
      </p>
    );
  }

  const ordered = [...checks].sort((a, b) => rank(a) - rank(b));

  return (
    <ul className="mt-3 space-y-2.5">
      {ordered.map((check, index) => (
        <li key={`${check.ruleKey}:${index}`} className="flex gap-3">
          <span
            aria-hidden
            className={
              check.status === "fail"
                ? "mt-0.5 size-4 shrink-0 rounded-full bg-destructive/15 text-center text-[10px] font-bold leading-4 text-destructive"
                : check.status === "warn"
                  ? "mt-0.5 size-4 shrink-0 rounded-full bg-muted text-center text-[10px] font-bold leading-4 text-muted-foreground"
                  : "mt-0.5 size-4 shrink-0 rounded-full bg-brand-soft text-center text-[10px] font-bold leading-4 text-brand"
            }
          >
            {check.status === "fail" ? "✕" : check.status === "warn" ? "!" : "✓"}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {check.ruleLabel}
              <span className="sr-only">{`: ${check.status}`}</span>
            </p>
            {check.explanation ? (
              <p className="text-sm text-pretty text-muted-foreground">{check.explanation}</p>
            ) : null}
            {check.evidence ? (
              <p className="mt-1 border-l-2 border-border pl-3 text-sm text-pretty text-muted-foreground">
                {check.evidence}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Failures first: they are the only rows anyone has to act on. */
function rank(check: StoredCheck): number {
  if (check.status === "fail") return 0;
  if (check.status === "warn") return 1;
  return 2;
}
