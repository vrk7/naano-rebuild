import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "./section";
import { Reveal } from "./reveal";

const CALL_COVERS = [
  "Which creators your buyers already read",
  "The campaign format and brief mode that fits",
  "A budget recommendation with the maths shown",
] as const;

export function FinalCta() {
  return (
    <Section aria-labelledby="cta-heading">
      <Container>
        <Reveal className="relative overflow-hidden rounded-3xl border border-brand-muted bg-brand-soft px-8 py-14 md:px-14">
          <div
            aria-hidden="true"
            className="anim-drift pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-brand/20 blur-3xl"
          />
          <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
                Ready to launch?
              </p>
              <h2
                id="cta-heading"
                className="mt-4 text-3xl font-semibold tracking-tight text-balance md:text-[2.75rem] md:leading-[1.08]"
              >
                Your next creator campaign starts with one honest number.
              </h2>
              <p className="mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
                Paste your website, confirm the ICPs we draft, and see the marketplace
                ranked against them in a few minutes.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-11 gap-2 px-5 text-[0.95rem] bg-brand text-brand-foreground hover:bg-brand/85"
                >
                  <Link href="/sign-up">
                    Launch a campaign
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 px-5 text-[0.95rem]">
                  <Link href="/contact">Book a 30-minute call</Link>
                </Button>
              </div>
            </div>

            <ul className="flex flex-col gap-3 rounded-2xl border border-brand-muted bg-card p-6">
              <li className="text-sm font-semibold">What the call covers</li>
              {CALL_COVERS.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
