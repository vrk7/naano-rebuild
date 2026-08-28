import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** One labelled input, with room for a line explaining what the field is for. */
export function Field({
  name,
  label,
  hint,
  className,
  ...input
}: {
  name: string;
  label: string;
  hint?: string;
} & Omit<React.ComponentPropsWithoutRef<"input">, "name" | "id">) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input id={name} name={name} className={INPUT_CLASS} {...input} />
      {hint ? <p className="text-xs text-pretty text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** The one button on an auth form. */
export function SubmitButton({
  pending,
  children,
  pendingLabel = "Working…",
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Errors and confirmations, in the one place a form reports either. */
export function FormMessage({
  error,
  notice,
}: {
  error?: string | null;
  notice?: string | null;
}) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-pretty text-destructive">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p role="status" className="rounded-md bg-brand-soft p-3 text-sm text-pretty">
        {notice}
      </p>
    );
  }
  return null;
}
