import Link from "next/link";
import { Wordmark } from "./wordmark";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Customers", href: "#proof" },
      { label: "Book a call", href: "/contact" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Wordmark />
          <p className="max-w-xs text-sm text-muted-foreground">
            The B2B LinkedIn creator marketplace where the score can say no and every
            lead names the post it came from.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wide uppercase">{column.heading}</h2>
            {column.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl border-t border-border px-6 py-6">
        <p className="text-xs text-muted-foreground">
          This is a rebuild. Company names, testimonials and figures on this page are
          illustrative placeholders drawn from the seeded demo workspace, not real
          customers or measured results.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          © {new Date().getFullYear()} naano rebuild. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
