import { Container, Section } from "./section";
import { CountUp } from "./count-up";
import { Reveal } from "./reveal";

const STATS = [
  { value: 5_140_000, suffix: "", label: "Impressions measured" },
  { value: 31_800, suffix: "", label: "People engaged and resolved" },
  { value: 2_140, suffix: "", label: "Creators scored against an ICP" },
  { value: 5_300, suffix: "", label: "Posts published and tracked" },
] as const;

export function Metrics() {
  return (
    <Section className="py-16 md:py-20">
      <Container>
        <Reveal className="rounded-3xl border border-border bg-card p-8 md:p-10">
          <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dd className="text-3xl font-semibold tracking-tight text-brand md:text-4xl">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </dd>
                <dt className="mt-2 text-sm text-muted-foreground">{stat.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
            Figures come from the seeded demo workspace. This rebuild simulates the
            engagement feed behind the interface a real collector would implement, and
            labels seeded rows as seeded inside the product.
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
