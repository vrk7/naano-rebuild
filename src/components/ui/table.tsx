import { cn } from "@/lib/utils";

/**
 * Dense data tables.
 *
 * Rows are 32px, not the 48px they were: this product's tables are read down a
 * column, and halving the row height doubles how many scores fit above the fold
 * without shrinking a single glyph.
 *
 * Figures are tabular for the whole `<table>` element — set once in globals.css
 * rather than as a class on every cell — because a column of scores that does
 * not line up cannot be compared, and relying on authors to remember
 * `tabular-nums` per cell is how it ends up missing on exactly one column.
 */
export function TableFrame({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("overflow-x-auto rounded-lg border border-border", className)}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"table">) {
  return <table className={cn("w-full text-sm", className)} {...props} />;
}

export function THead({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"thead">) {
  return (
    <thead
      className={cn("border-b border-border bg-subtle text-left", className)}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"tbody">) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TFoot({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"tfoot">) {
  return (
    <tfoot
      className={cn("border-t border-border bg-subtle", className)}
      {...props}
    />
  );
}

/**
 * A row. `interactive` is for rows that are actually clickable — the hover tint
 * is a promise that something happens, so a static row does not get one.
 */
export function TR({
  className,
  interactive = false,
  ...props
}: React.ComponentPropsWithoutRef<"tr"> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(interactive && "transition-colors hover:bg-muted/50", className)}
      {...props}
    />
  );
}

/**
 * A header cell. `numeric` right-aligns it so the header sits over its own
 * column of digits instead of over the left edge of the gap.
 */
export function TH({
  className,
  numeric = false,
  ...props
}: React.ComponentPropsWithoutRef<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] whitespace-nowrap text-muted-foreground",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  numeric = false,
  ...props
}: React.ComponentPropsWithoutRef<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn("px-3 py-2 align-top", numeric && "text-right", className)}
      {...props}
    />
  );
}

/** The second line in a cell: a role under a name, a campaign under a creator. */
export function CellNote({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn("mt-0.5 block text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}
