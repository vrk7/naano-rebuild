"use client";

import { useActionState, useState } from "react";

import { FormMessage, Input, Label, SubmitButton } from "@/components/ui/field";
import { parsePriceCents } from "@/lib/collaboration/booking";
import { RESPOND_WINDOW_HOURS } from "@/lib/collaboration/machine";
import { formatCents } from "@/lib/posts/metrics";

import { submitBooking, type BookingFormState } from "./actions";

const INITIAL: BookingFormState = { error: null };

/**
 * Price, post_by, approval (PRODUCT.md step 7).
 *
 * Three fields, one submit, no negotiation — SCOPE.md cuts counter-offers, so
 * the creator's only answers are accept and decline. The two lines under the
 * form are the point of it: what leaves the wallet, and what the creator gets
 * to decide, said before the button rather than in a toast afterwards.
 */
export function BookingForm({
  campaignId,
  creatorId,
  creatorName,
  defaultPriceCents,
  defaultPostBy,
  earliestPostBy,
  walletBalanceCents,
}: {
  campaignId: string;
  creatorId: string;
  creatorName: string;
  defaultPriceCents: number | null;
  defaultPostBy: string;
  earliestPostBy: string;
  walletBalanceCents: number;
}) {
  const [state, formAction, pending] = useActionState(
    submitBooking.bind(null, campaignId, creatorId),
    INITIAL,
  );

  const [price, setPrice] = useState(
    defaultPriceCents === null ? "" : (defaultPriceCents / 100).toString(),
  );
  const [approvalRequired, setApprovalRequired] = useState(true);

  // Mirrors the server parser exactly, so the line below the field can never
  // promise a commitment the server would round differently.
  const parsed = parsePriceCents(price);
  const commits = parsed.kind === "ok" ? parsed.value : null;

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="price">Price</Label>
        {/* The unit sits inside the field rather than beside it: a floating "$"
            next to an input reads as a separate piece of UI, and the amount is
            tabular so it does not reflow as digits are typed. */}
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
          >
            $
          </span>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="1500"
            required
            className="num pl-5 tabular-nums"
          />
        </div>
        <p className="text-xs text-pretty text-muted-foreground">
          {defaultPriceCents === null
            ? "This creator has not published a rate, so there is nothing to prefill."
            : `Their published rate is ${formatCents(defaultPriceCents)} per post. One price, sent once — there is no counter-offer.`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="post_by">Post by</Label>
        <Input
          id="post_by"
          name="post_by"
          type="date"
          defaultValue={defaultPostBy}
          min={earliestPostBy}
          required
        />
        <p className="text-xs text-pretty text-muted-foreground">
          The creator has {RESPOND_WINDOW_HOURS} hours to answer, so the earliest a
          post can be due is {earliestPostBy}.
        </p>
      </div>

      <div className="rounded-lg border border-border p-3.5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/25">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="approval_required"
            checked={approvalRequired}
            onChange={(event) => setApprovalRequired(event.target.checked)}
            className="mt-0.5 size-4 accent-[var(--brand)]"
          />
          <span>
            <span className="block text-sm font-medium">I want to approve the draft</span>
            <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">
              {approvalRequired
                ? "The draft comes to you with its checks before it can be published."
                : "The draft is approved as soon as it passes its checks, and the creator publishes without waiting for you."}
            </span>
          </span>
        </label>
      </div>

      {/* What this actually costs, stated before the button rather than in a
          toast afterwards. Both figures are tabular so the commitment and the
          balance can be compared at a glance. */}
      <div className="rounded-lg border border-border bg-muted/50 p-3.5 text-sm text-pretty">
        <p>
          Sending this commits{" "}
          <strong className="num tabular-nums">
            {commits === null ? "—" : formatCents(commits)}
          </strong>{" "}
          against your wallet, which holds{" "}
          <span className="num tabular-nums">{formatCents(walletBalanceCents)}</span>.
          Nothing leaves; the ledger records the commitment.
        </p>
        <p className="mt-2 text-muted-foreground">
          {creatorName} has {RESPOND_WINDOW_HOURS} hours to accept or decline. If they
          do neither, the invitation expires.
        </p>
      </div>

      <FormMessage error={state.error} />
      <SubmitButton pending={pending} pendingLabel="Sending…" className="w-full">
        Send the offer
      </SubmitButton>
    </form>
  );
}
