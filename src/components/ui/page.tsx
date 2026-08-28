import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The page frame. One max-width and one vertical rhythm for every app screen,
 * rather than the mix of max-w-3xl/5xl/6xl and py-12 that had accumulated.
 *
 * `width` is the only knob: `wide` for tables that need the room, `default` for
 * everything else, `narrow` for a single form, which should not stretch to
 * 1100px just because the viewport allows it.
 */
const WIDTH = {
  narrow: "max-w-2xl",
  default: "max-w-4xl",
  wide: "max-w-6xl",
} as const;

export function Page({
  width = "default",
  className,
  ...props
}: React.ComponentPropsWithoutRef<"main"> & { width?: keyof typeof WIDTH }) {
  return (
    <main
      className={cn("mx-auto px-6 py-8", WIDTH[width], className)}
      {...props}
    />
  );
}

/**
 * Title, one line of what the screen is for, and the screen's single action.
 * The description is not decoration here — most of these screens are explaining
 * a number, and the sentence under the title is where that starts.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.014em]">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-prose text-md text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A titled block within a page, with an optional count or note on the right. */
export function SectionHeader({
  title,
  meta,
  description,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold tracking-[-0.008em]">{title}</h2>
        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
      </div>
      {description ? (
        <p className="mt-1 max-w-prose text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The way back out of a detail screen.
 *
 * A real chevron rather than the "←" character these pages were using: the
 * literal arrow renders in whatever fallback font the browser picks for it and
 * sits a few pixels off the text baseline at every size.
 */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25"
    >
      <ChevronLeft aria-hidden className="size-3.5" />
      {children}
    </Link>
  );
}
