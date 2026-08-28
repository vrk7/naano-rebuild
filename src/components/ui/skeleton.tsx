import { cn } from "@/lib/utils";

/**
 * A placeholder block while a route's data is in flight.
 *
 * Deliberately quiet — a flat tint, no shimmer. A pulsing gradient across a
 * dense table is more motion than the page it is standing in for, and these
 * routes resolve in a few hundred milliseconds; the skeleton's job is to hold
 * the layout so nothing jumps when the real rows arrive, not to entertain.
 *
 * It reserves the same height the real content will take, which is what keeps
 * the swap from shifting the page.
 */
export function Skeleton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden
      className={cn("rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/**
 * The shape every list-and-table route resolves into: a title, a line of
 * description, then rows. Shared so the four loading states cannot drift from
 * each other or from the pages they precede.
 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-full max-w-md" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
