import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroVisual } from "./hero-visual";

const AVATARS = ["PR", "ID", "MF", "LK", "TR"] as const;

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden px-6 pt-14 pb-20 md:pt-20 md:pb-28"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="grid-backdrop absolute inset-0 opacity-70" />
        <div className="anim-drift absolute -top-56 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
        <div
          className="anim-drift absolute top-24 -right-40 size-[26rem] rounded-full bg-brand/10 blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <span className="anim-rise inline-flex items-center gap-2 rounded-full border border-brand-muted bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
          <span className="size-1.5 rounded-full bg-brand" />
          The B2B LinkedIn creator marketplace
        </span>

        <h1
          id="hero-heading"
          className="anim-rise text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-[4rem] md:leading-[1.04]"
          style={{ animationDelay: "0.08s" }}
        >
          Point at a post.
          <br />
          <span className="text-brand">See who it brought in.</span>
        </h1>

        <p
          className="anim-rise max-w-2xl text-lg text-pretty text-muted-foreground md:text-xl"
          style={{ animationDelay: "0.16s" }}
        >
          naano scores creators against the ICP you actually sell to, keeps the brief
          honest, and traces every reaction back to a person, a company, and whether
          they match. No card that reads 100% for everyone.
        </p>

        <div
          className="anim-rise flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: "0.24s" }}
        >
          <Button
            asChild
            size="lg"
            className="h-11 gap-2 px-5 text-[0.95rem] bg-brand text-brand-foreground hover:bg-brand/85"
          >
            <Link href="/register">
              Launch a campaign
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-5 text-[0.95rem]">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>

        <div
          className="anim-rise flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "0.32s" }}
        >
          <span className="flex -space-x-2">
            {AVATARS.map((initials) => (
              <span
                key={initials}
                className="grid size-7 place-items-center rounded-full border-2 border-background bg-brand-soft text-[0.6rem] font-semibold text-brand"
              >
                {initials}
              </span>
            ))}
          </span>
          <span className="text-sm text-muted-foreground">
            3,000+ vetted creators across 100 countries
          </span>
        </div>
      </div>

      <div className="mt-16 md:mt-20">
        <HeroVisual />
      </div>
    </section>
  );
}
