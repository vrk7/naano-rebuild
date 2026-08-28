import {
  Building2,
  CircleSlash,
  Gauge,
  ListChecks,
  ScanSearch,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";
import { ScoreRing } from "./score-ring";

const SMALL_FEATURES = [
  {
    icon: CircleSlash,
    title: "It refuses to answer",
    body: "Under 100 engagers or 10 posts analysed, the profile says “Not enough data” and sorts last. A greyed-out number is still a number people quote in a deck.",
  },
  {
    icon: ListChecks,
    title: "Briefs that check themselves",
    body: "Required mentions, tracked link, length band, disclosure, banned claims. Every failure quotes the span of the draft it judged — no unarguable adherence score.",
  },
  {
    icon: ScanSearch,
    title: "One vocabulary, end to end",
    body: "The same topic list drives creator tags, ICP targets and marketplace filters, so no creator is unreachable because two lists drifted apart.",
  },
] as const;

const ICP_CHIPS = [
  "Sales Engineering",
  "Operations",
  "Director+",
  "Industrial mfg.",
  "DE",
  "FR",
  "NL",
] as const;

const ATTRIBUTION_STATS = [
  { label: "People engaged", value: "612" },
  { label: "Companies resolved", value: "188" },
  { label: "ICP-matched", value: "74" },
  { label: "Cost / matched person", value: "€14.80" },
] as const;

const CARD_BASE =
  "group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-muted hover:shadow-[0_20px_50px_-30px_oklch(0.2_0.05_259/0.6)]";

function FeatureIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
      <Icon className="size-4.5" />
    </span>
  );
}

export function FeatureGrid() {
  return (
    <Section id="features" aria-labelledby="features-heading" className="scroll-mt-16">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          id="features-heading"
          eyebrow="What makes it different"
          title="Built to be argued with"
          lead="Every number on the screen can be traced to the data that produced it — including the ones you will not like."
        />

        <div className="grid gap-4 lg:grid-cols-6">
          <Reveal className={cn(CARD_BASE, "lg:col-span-4")}>
            <FeatureIcon icon={Gauge} />
            <h3 className="mt-4 text-xl font-semibold tracking-tight">A score that can say no</h3>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">
              Every creator is scored 0–100 against your ICP, and plenty of them land in
              the thirties. The number decomposes into job function, seniority, industry
              and geo, so you can see which leg is carrying it before you spend.
            </p>
            <ul className="mt-6 flex flex-wrap gap-6">
              {[
                { value: 78, label: "Strong overlap" },
                { value: 44, label: "Partial overlap" },
                { value: null, label: "Sample too small" },
              ].map((item, index) => (
                <li key={item.label} className="flex items-center gap-3">
                  <ScoreRing value={item.value} delaySeconds={0.2 + index * 0.15} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delayMs={80} className={cn(CARD_BASE, "lg:col-span-2")}>
            <FeatureIcon icon={Target} />
            <h3 className="mt-4 text-xl font-semibold tracking-tight">
              ICPs as targets, not paragraphs
            </h3>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">
              Roles, seniorities, industries and regions as editable chips. You cannot
              score a creator against three paragraphs of prose.
            </p>
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {ICP_CHIPS.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-brand-muted bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </Reveal>

          {SMALL_FEATURES.map((feature, index) => (
            <Reveal
              key={feature.title}
              delayMs={index * 80}
              className={cn(CARD_BASE, "lg:col-span-2")}
            >
              <FeatureIcon icon={feature.icon} />
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{feature.body}</p>
            </Reveal>
          ))}

          <Reveal className={cn(CARD_BASE, "lg:col-span-6")}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-12">
              <div className="lg:max-w-md">
                <FeatureIcon icon={Building2} />
                <h3 className="mt-4 text-xl font-semibold tracking-tight">
                  Post → people → companies → cost
                </h3>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">
                  Open a published post and see the named people who engaged, the
                  companies they work for, which ICP they match, and what the post cost
                  you per matched person. Export the lot as CSV with the post as source.
                </p>
              </div>
              <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                {ATTRIBUTION_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-muted/60 p-4">
                    <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
