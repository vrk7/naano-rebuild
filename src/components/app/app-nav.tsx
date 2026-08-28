"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type NavLink = { readonly href: string; readonly label: string };

/**
 * The nav links, with the current section marked.
 *
 * Previously every link rendered identically, so the shell could not answer
 * "where am I" — on a four-section product that is the one job a nav has.
 *
 * Matching is prefix-based so `/brand/campaigns/:id` still lights up Campaigns,
 * with an exact-match exception for the index href: `/brand` is a prefix of
 * every other route here, and without that carve-out Campaigns would stay lit
 * on all of them.
 */
export function AppNav({ links }: { links: ReadonlyArray<NavLink> }) {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-0.5">
      {links.map((link) => {
        const isRoot = link.href.split("/").length === 2;
        const isActive = isRoot
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-2.5 text-sm transition-colors",
                isActive
                  ? "bg-brand-soft font-medium text-brand"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
