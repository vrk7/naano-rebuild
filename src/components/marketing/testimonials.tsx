import { Quote } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const FEATURED = {
  quote:
    "We stopped guessing which creator was worth it. The score told us two of our shortlist were wrong, and the post page told us exactly why.",
  name: "Vincent Osei",
  role: "Head of Growth, Lumen Labs",
  results: [
    { label: "Creators activated", value: "9" },
    { label: "Tracked clicks", value: "2,940" },
    { label: "Trials started", value: "512" },
  ],
} as const;

const TESTIMONIALS = [
  {
    quote:
      "The first tool that ever told me a creator was a bad fit. That is the whole reason I trust it about the good ones.",
    name: "Dana Wexler",
    role: "VP Marketing, Corva",
  },
  {
    quote:
      "Our ICP used to live in a slide nobody opened. Now it is a set of targets the marketplace actually reads.",
    name: "Samir Haddad",
    role: "Demand Gen Lead, Beacon HQ",
  },
  {
    quote:
      "Pointing at a post and naming the companies it brought in is the report my CFO had been asking for.",
    name: "Marta Lindqvist",
    role: "Director of Partnerships, Meridian Freight",
  },
] as const;

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
      {initials}
    </span>
  );
}

export function Testimonials() {
  return (
    <Section id="proof" aria-labelledby="proof-heading" className="scroll-mt-16">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          id="proof-heading"
          eyebrow="Customers"
          title="The report was always the point"
          lead="Teams do not want another dashboard. They want to know which post produced the pipeline."
        />

        <Reveal className="grid gap-8 rounded-3xl border border-border bg-brand-soft/60 p-8 md:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <figure>
            <Quote className="size-7 text-brand" aria-hidden="true" />
            <blockquote className="mt-4 text-xl font-medium text-balance md:text-2xl md:leading-snug">
              {FEATURED.quote}
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <Avatar name={FEATURED.name} />
              <span className="text-sm">
                <span className="block font-semibold">{FEATURED.name}</span>
                <span className="block text-muted-foreground">{FEATURED.role}</span>
              </span>
            </figcaption>
          </figure>
          <dl className="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:gap-5">
            {FEATURED.results.map((result) => (
              <div key={result.label} className="rounded-2xl border border-brand-muted bg-card p-4">
                <dd className="text-2xl font-semibold tabular-nums text-brand">{result.value}</dd>
                <dt className="mt-1 text-xs text-muted-foreground">{result.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <Reveal
              key={testimonial.name}
              delayMs={index * 90}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-brand-muted"
            >
              <figure className="flex h-full flex-col justify-between gap-6">
                <blockquote className="text-sm text-pretty">{testimonial.quote}</blockquote>
                <figcaption className="flex items-center gap-3">
                  <Avatar name={testimonial.name} />
                  <span className="text-xs">
                    <span className="block font-semibold">{testimonial.name}</span>
                    <span className="block text-muted-foreground">{testimonial.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
