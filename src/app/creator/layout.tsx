import { AppShell } from "@/components/app/app-shell";

/**
 * The creator-side shell.
 *
 * One link, because there is one thing here: the collaborations they have been
 * booked on. SCOPE.md cuts the creator's own analytics, their earnings and the
 * affiliate surface, so a second nav item would have to be invented before it
 * could be shown.
 *
 * It exists mostly for the third item — signing out. The brand side has had a
 * shell since it had two screens; the creator side grew to two and did not,
 * which left an account with no way to leave it.
 */
const LINKS = [{ href: "/creator", label: "Collaborations" }] as const;

export default function CreatorLayout({ children }: LayoutProps<"/creator">) {
  return <AppShell links={LINKS}>{children}</AppShell>;
}
