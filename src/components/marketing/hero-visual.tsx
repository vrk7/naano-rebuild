import { PostLeadsCard } from "./post-leads-card";
import { ScoreCard } from "./score-card";

/**
 * Three cards, layered. The centre one is the post-to-leads screen; the two
 * around it are the same scoring engine answering 78 for one creator and 31
 * for another, which is the argument the whole page is making.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="anim-rise mx-auto w-full max-w-lg" style={{ animationDelay: "0.3s" }}>
        <PostLeadsCard />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:mt-0 lg:contents">
        <div
          className="anim-rise lg:absolute lg:top-12 lg:left-0 lg:w-72"
          style={{ animationDelay: "0.55s" }}
        >
          <div className="anim-float" style={{ animationDelay: "1.2s" }}>
            <ScoreCard
              creator="Ines Delacroix"
              audience="Ops & engineering leaders · DACH"
              value={78}
              confidence="high"
              dimensions={[
                { label: "Job function", overlap: 0.74 },
                { label: "Seniority", overlap: 0.66 },
                { label: "Industry", overlap: 0.81 },
                { label: "Geo", overlap: 0.92 },
              ]}
              detractor="Seniority is the weak leg — 34% of this audience are individual contributors."
            />
          </div>
        </div>

        <div
          className="anim-rise lg:absolute lg:right-0 lg:bottom-4 lg:w-72"
          style={{ animationDelay: "0.8s" }}
        >
          <div className="anim-float" style={{ animationDelay: "2.4s" }}>
            <ScoreCard
              creator="Dmitri Sokolov"
              audience="Generalist B2B · 180k followers"
              value={31}
              confidence="high"
              dimensions={[
                { label: "Job function", overlap: 0.22 },
                { label: "Seniority", overlap: 0.41 },
                { label: "Industry", overlap: 0.29 },
                { label: "Geo", overlap: 0.04 },
              ]}
              detractor="96% of this audience is outside your target regions."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
