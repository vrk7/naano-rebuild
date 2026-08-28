import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const STEPS = [
  {
    title: "Describe your ICP",
    body: "Paste your website. We draft three ICPs as structured targets — roles, seniorities, industries, regions — and you edit the chips. It is the one step you cannot skip.",
  },
  {
    title: "Score the market",
    body: "Every creator in the marketplace is ranked against that campaign. Low confidence sorts last. Low scores stay visible and labelled.",
  },
  {
    title: "Brief and book",
    body: "Specific requirements or creative freedom — both are real modes. One price, accept or decline, budget committed to the ledger on accept.",
  },
  {
    title: "Draft, check, publish",
    body: "The creator writes, deterministic checks run and cite the spans they judged, you approve or request changes, then the post goes live.",
  },
  {
    title: "Read the leads",
    body: "Who engaged, where they work, which ICP they match, what it cost per matched person. Exported with the post as the source.",
  },
] as const;

export function Journey() {
  return (
    <Section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-16 bg-muted/30"
    >
      <Container className="flex flex-col gap-14">
        <SectionHeading
          id="how-it-works-heading"
          eyebrow="How it works"
          title="One platform, from ICP to pipeline"
          lead="Five steps, each one ending somewhere you can point at."
        />

        <ol className="relative grid gap-8 lg:grid-cols-5 lg:gap-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-5 right-0 left-0 hidden h-px bg-border lg:block"
          />
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <Reveal delayMs={index * 90} className="flex gap-4 lg:flex-col">
                <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-brand-muted bg-background text-sm font-semibold text-brand">
                  {index + 1}
                </span>
                <div className="lg:mt-2">
                  <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{step.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
