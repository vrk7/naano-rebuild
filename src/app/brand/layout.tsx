import { AppShell } from "@/components/app/app-shell";

/**
 * The brand-side shell.
 *
 * Three links, no tour, no checklist, no nudge toast — SCOPE.md cuts all three
 * because naano runs them at once and they collide. The marketplace has to be
 * reachable for the score to be worth anything, and this is the whole of that.
 */
const LINKS = [
  { href: "/brand", label: "Campaigns" },
  { href: "/brand/creators", label: "Creators" },
  { href: "/brand/posts", label: "Posts" },
  // Leads is the same data as Posts, aggregated the other way: per person
  // rather than per post. Both are listed because a brand arrives with one of
  // those two questions and not reliably the other.
  { href: "/brand/leads", label: "Leads" },
  // The ICP editor is not an onboarding screen you pass through once. It is
  // the only place the score's inputs can be corrected, and naano's own open
  // question is whether that is even possible there (recon/NOTES.md).
  { href: "/brand/icps", label: "ICPs" },
  { href: "/brand/wallet", label: "Wallet" },
] as const;

export default function BrandLayout({ children }: LayoutProps<"/brand">) {
  return <AppShell links={LINKS}>{children}</AppShell>;
}
