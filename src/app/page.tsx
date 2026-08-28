import { Faq } from "@/components/marketing/faq";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { Journey } from "@/components/marketing/journey";
import { LogoWall } from "@/components/marketing/logo-wall";
import { Metrics } from "@/components/marketing/metrics";
import { Pricing } from "@/components/marketing/pricing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Testimonials } from "@/components/marketing/testimonials";

export default function Page() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <LogoWall />
        <FeatureGrid />
        <Journey />
        <Metrics />
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
