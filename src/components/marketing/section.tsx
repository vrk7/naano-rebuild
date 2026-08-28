import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

type SectionProps = React.ComponentProps<"section">;

/** Vertical rhythm for every band on the landing page. */
export function Section({ className, ...props }: SectionProps) {
  return <section className={cn("px-6 py-20 md:py-28", className)} {...props} />;
}

/** Centres content on the same measure across every section. */
export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-xs font-semibold tracking-[0.16em] text-brand uppercase",
        className,
      )}
      {...props}
    />
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  id?: string;
  align?: "start" | "center";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "flex max-w-2xl flex-col gap-4",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className="text-3xl font-semibold tracking-tight text-balance md:text-[2.75rem] md:leading-[1.08]"
      >
        {title}
      </h2>
      {lead ? <p className="text-lg text-pretty text-muted-foreground">{lead}</p> : null}
    </Reveal>
  );
}
