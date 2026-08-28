import { cn } from "@/lib/utils";

type Engager = {
  name: string;
  role: string;
  company: string;
  /** Which ICP this person matched, or null when none did. */
  icp: string | null;
  score: number | null;
};

const ENGAGERS: Engager[] = [
  {
    name: "Marcus Feld",
    role: "Head of Sales Engineering",
    company: "Kessler Fluid Systems",
    icp: "ICP 1",
    score: 88,
  },
  {
    name: "Lena Kovac",
    role: "VP Operations",
    company: "Northwind Industrial",
    icp: "ICP 1",
    score: 81,
  },
  {
    name: "Tomás Ruiz",
    role: "Procurement Lead",
    company: "Vantage Castings",
    icp: "ICP 2",
    score: 74,
  },
  {
    name: "Ade Balogun",
    role: "Growth Marketer",
    company: "Independent",
    icp: null,
    score: null,
  },
];

const METRICS = [
  { label: "Impressions", value: "128,400" },
  { label: "Reactions", value: "612" },
  { label: "Comments", value: "88" },
] as const;

/** First letter of the first two words — enough for a placeholder avatar. */
function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

/**
 * The screen the whole product exists for, shrunk to hero size: one published
 * post, and the named people it brought in.
 */
export function PostLeadsCard({ className }: { className?: string }) {
  return (
    <article
      className={cn(
        "w-full rounded-3xl border border-border bg-card p-6 shadow-[0_40px_100px_-40px_oklch(0.2_0.05_259/0.55)]",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
          PR
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Priya Raman</p>
          <p className="truncate text-xs text-muted-foreground">
            Supply-chain operations · 41,200 followers
          </p>
        </div>
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-2xs font-medium text-brand">
          Published
        </span>
      </header>

      <p className="mt-4 line-clamp-2 text-sm text-pretty text-muted-foreground">
        &ldquo;Most RFQ delays are not a supplier problem. Three quotes, three formats,
        two weeks of chasing — here is what changed when we cut it to one…&rdquo;
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3">
        {METRICS.map((metric) => (
          <div key={metric.label}>
            <dt className="text-2xs text-muted-foreground">{metric.label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex items-center gap-2">
        <span className="relative grid size-2 place-items-center">
          <span className="anim-ping absolute size-2 rounded-full bg-brand" />
          <span className="size-2 rounded-full bg-brand" />
        </span>
        <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">
          People who engaged
        </h3>
      </div>

      <ul className="mt-3 space-y-2">
        {ENGAGERS.map((person, index) => (
          <li
            key={person.name}
            className="anim-rise flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5"
            style={{ animationDelay: `${0.7 + index * 0.22}s` }}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground">
              {initials(person.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{person.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {person.role} · {person.company}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-2xs font-medium tabular-nums",
                person.icp
                  ? "bg-brand-soft text-brand"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {person.icp ? `${person.icp} · ${person.score}` : "No match"}
            </span>
          </li>
        ))}
      </ul>

      <footer className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs">
        <span className="text-muted-foreground">Cost per ICP-matched person</span>
        <span className="font-semibold tabular-nums">€14.80</span>
      </footer>
    </article>
  );
}
