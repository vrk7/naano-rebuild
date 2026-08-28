const COMPANIES = [
  "Northwind",
  "Kessler Fluid",
  "Vantage Castings",
  "Lumen Labs",
  "Corva",
  "Beacon HQ",
  "Tessellate",
  "Orbit CRM",
  "Meridian Freight",
  "Kaido",
] as const;

/**
 * Continuous logo marquee. The list is rendered twice and the track is
 * translated by exactly -50%, so the loop point is invisible.
 */
export function LogoWall() {
  return (
    <section aria-label="Companies running campaigns on naano" className="border-y border-border/70 bg-muted/30 py-10">
      <p className="mb-6 text-center text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Revenue teams running creator campaigns on naano
      </p>
      <div
        className="marquee-viewport overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
        }}
      >
        <ul className="marquee-track flex w-max items-center gap-12 pr-12">
          {[...COMPANIES, ...COMPANIES].map((company, index) => (
            <li
              key={`${company}-${index}`}
              aria-hidden={index >= COMPANIES.length}
              className="text-lg font-semibold whitespace-nowrap text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              {company}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
