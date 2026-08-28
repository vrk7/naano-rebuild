import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

type Plan = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: readonly string[];
  cta: string;
  /** Absent when the plan has nowhere real to send anyone — see Managed. */
  href?: string;
  isFeatured?: boolean;
};

const PLANS: readonly Plan[] = [
  {
    name: "Self-serve",
    price: "€0",
    period: "/month",
    description: "Everything needed to run one campaign properly, end to end.",
    features: [
      "Full marketplace with scores and breakdowns",
      "One active campaign, three structured ICPs",
      "Both brief modes and deterministic draft checks",
      "Post-level attribution and CSV lead export",
      "Ledger-backed budget commits",
    ],
    cta: "Start free",
    href: "/register",
  },
  {
    name: "Growth",
    price: "€249",
    period: "/month",
    description: "For teams running creators as a standing acquisition channel.",
    features: [
      "Everything in Self-serve",
      "Unlimited campaigns and saved segments",
      "Team seats with owner and admin roles",
      "Refreshed audience snapshots and re-scoring",
      "Weekly lead digests by ICP",
      "Priority matching support",
    ],
    cta: "Start 14-day trial",
    href: "/register",
    isFeatured: true,
  },
  {
    name: "Managed",
    price: "Custom",
    description: "We run the campaign with you, from sourcing to the readout.",
    features: [
      "Creator strategy and sourcing",
      "Brief writing and draft review",
      "Campaign reporting against your ICPs",
      "A named strategist on the account",
    ],
    // No href: a managed service needs people, and this rebuild has none. The
    // card still says what the tier would cover; the button says it is not
    // here, which is the same thing SCOPE.md does in prose.
    cta: "Not in this rebuild",
  },
];

export function Pricing() {
  return (
    <Section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-16 bg-muted/30">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          id="pricing-heading"
          eyebrow="Pricing"
          title="Pay for the platform, not the guesswork"
          lead="Campaign spend goes to creators and is billed separately. No lock-in, cancel anytime."
        />

        <div className="grid items-start gap-5 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal
              key={plan.name}
              delayMs={index * 90}
              className={cn(
                "relative flex flex-col gap-6 rounded-3xl border bg-card p-7 transition-shadow",
                plan.isFeatured
                  ? "border-brand shadow-[0_28px_70px_-38px_oklch(0.2_0.05_259/0.8)] lg:-mt-4 lg:pt-10 lg:pb-10"
                  : "border-border hover:shadow-[0_20px_50px_-38px_oklch(0.2_0.05_259/0.7)]",
              )}
            >
              {plan.isFeatured ? (
                <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-2xs font-semibold text-brand-foreground">
                  Most popular
                </span>
              ) : null}

              <div>
                <h3 className="text-sm font-semibold tracking-wide uppercase">{plan.name}</h3>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                  {plan.period ? (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  ) : null}
                </p>
                <p className="mt-3 text-sm text-pretty text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <ul className="flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild={plan.href !== undefined}
                disabled={plan.href === undefined}
                size="lg"
                variant={plan.isFeatured ? "default" : "outline"}
                className={cn(
                  "h-11 w-full text-base",
                  plan.isFeatured && "bg-brand text-brand-foreground hover:bg-brand/85",
                )}
              >
                {plan.href ? <Link href={plan.href}>{plan.cta}</Link> : plan.cta}
              </Button>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
