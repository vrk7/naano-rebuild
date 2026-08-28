import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "./wordmark";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#proof", label: "Customers" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

/**
 * Sticky header. The small-screen menu is a native <details> disclosure so it
 * works before hydration and needs no state.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6">
        <Link href="/" aria-label="naano home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button asChild variant="ghost" size="lg" className="hidden sm:inline-flex">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="lg" className="bg-brand text-brand-foreground hover:bg-brand/85">
            <Link href="/sign-up">Launch a campaign</Link>
          </Button>

          <details className="relative md:hidden">
            <summary
              aria-label="Open menu"
              className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-border [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-4" />
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 top-11 w-52 rounded-xl border border-border bg-popover p-2 shadow-lg"
            >
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/sign-in"
                className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Sign in
              </a>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
