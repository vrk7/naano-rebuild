import { ChevronDown } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const QUESTIONS = [
  {
    question: "How is the match score calculated?",
    answer:
      "Four dimensions: job function, seniority, industry and geo. For each one we take the share of the creator's observed audience that falls inside your ICP targets, weight it, and sum the result into 0–100. The weights are visible in the breakdown, and they are currently a stated guess rather than a calibrated number — we would rather say that than pretend otherwise.",
  },
  {
    question: "Why do some creators show “Not enough data”?",
    answer:
      "Because a number off a handful of engagers is not a measurement. Under 100 engagers or 10 analysed posts we refuse to score, say so on the card, and sort that creator last. We do not show a faint number, because a number on screen is a number that ends up in a deck.",
  },
  {
    question: "Where does the audience data come from?",
    answer:
      "Public profile and post analysis, stored per dimension rather than as a blob, which is what lets the score decompose and show its working. Neither you nor the creator connects a personal LinkedIn account.",
  },
  {
    question: "How does attribution work without a LinkedIn API?",
    answer:
      "Honestly: LinkedIn does not expose who reacted to someone else's post, to us or to anyone else. In this build the engagement feed is simulated behind the interface a real collector would implement, and seeded rows are labelled as seeded inside the product. Everything above that layer — company resolution, ICP matching, cost per matched person, export — is real code running on that data.",
  },
  {
    question: "Can a creator negotiate the price?",
    answer:
      "No. One price, accept or decline, inside a 72-hour window. Counter-offers add states to the collaboration machine without testing anything we care about.",
  },
  {
    question: "What happens to my budget?",
    answer:
      "It is committed to a ledger when the creator accepts and released when the collaboration completes. Every movement is an append-only entry you can read back.",
  },
  {
    question: "Can I bring my own creators?",
    answer:
      "Yes. Invite them to a collaboration and they land in a thin workspace with the brief and the draft editor. There is no separate creator signup to complete first.",
  },
] as const;

export function Faq() {
  return (
    <Section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
        <SectionHeading
          id="faq-heading"
          align="start"
          eyebrow="FAQ"
          title="The questions worth asking first"
          lead="Including the one about where the lead data actually comes from."
          className="lg:sticky lg:top-24"
        />

        <div className="flex flex-col gap-3">
          {QUESTIONS.map((item, index) => (
            <Reveal key={item.question} delayMs={index * 60}>
              <details className="group rounded-2xl border border-border bg-card px-5 transition-colors open:border-brand-muted hover:border-brand-muted">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180"
                  />
                </summary>
                <p className="pb-5 text-sm text-pretty text-muted-foreground">{item.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
