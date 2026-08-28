import { cn } from "@/lib/utils";

/**
 * The mark is a post (the filled dot) with the audience it reached drawn as
 * arcs around it — the one claim, at 24px.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-7 place-items-center rounded-[0.5rem] bg-brand text-brand-foreground">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path
            d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 18.5A6.5 6.5 0 0 1 5.5 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight">naano</span>
    </span>
  );
}
