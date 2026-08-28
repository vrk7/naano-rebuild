import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one input style. 32px tall to sit level with a default Button.
 *
 * The focus ring is the accent, not a neutral glow: focus is a state the
 * keyboard user is steering, and it has to be findable at a glance across a
 * dense form. Ring, not border-colour alone — a 1px hue change is not a focus
 * indicator.
 */
const CONTROL =
  "w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25";

export function Input({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input">) {
  return <input className={cn(CONTROL, "h-8", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn(CONTROL, "py-1.5 leading-relaxed", className)} {...props} />;
}

export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"label">) {
  return (
    <label className={cn("block text-sm font-medium", className)} {...props} />
  );
}

/**
 * A labelled control with its hint and its own error.
 *
 * The error is rendered next to the field it belongs to and wired with
 * `aria-describedby`, so a screen reader reaching the input hears what is wrong
 * with *it*. A single message at the bottom of the form — which is what this
 * app had — tells a keyboard user something failed without telling them where.
 *
 * `hint` and `error` share the describedby list, and the hint survives the
 * error: the rule you broke is usually the thing you still need to read.
 */
export function Field({
  name,
  label,
  hint,
  error,
  className,
  children,
  ...input
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string | null;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"input">, "name" | "id" | "children">) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>

      {children ?? (
        <Input
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
      )}

      {hint ? (
        <p id={hintId} className="text-xs text-pretty text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-pretty text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Form-level outcome: the failure that belongs to the submit, not to a field.
 *
 * `tabIndex={-1}` so a form can move focus here after a failed submit, which is
 * the only way a keyboard user finds out the server said no.
 */
export function FormMessage({
  error,
  notice,
}: {
  error?: string | null;
  notice?: string | null;
}) {
  if (error) {
    return (
      <p
        role="alert"
        tabIndex={-1}
        className="rounded-md border border-destructive/25 bg-destructive-soft px-2.5 py-1.5 text-sm text-pretty text-destructive"
      >
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p
        role="status"
        className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-sm text-pretty text-muted-foreground"
      >
        {notice}
      </p>
    );
  }
  return null;
}

/**
 * The one submit on a form.
 *
 * `lg` (36px) rather than the 32px default: this is the control the whole screen
 * is pointed at, and on a touch screen it is the one place in a dense UI where
 * the extra height is worth the pixels. `w-full` is opt-out via className for
 * the wide forms where a full-bleed button would look like a banner.
 *
 * Disabled while pending, and the label changes with it — a button that looks
 * identical mid-submit gets clicked twice.
 */
export function SubmitButton({
  pending,
  children,
  pendingLabel = "Working…",
  className,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <Button type="submit" size="lg" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
