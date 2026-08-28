import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Callout, EmptyState } from "@/components/ui/callout";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Metric, MetricRow } from "@/components/ui/metric";
import { Page, PageHeader, SectionHeader } from "@/components/ui/page";
import {
  TableFrame,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  CellNote,
} from "@/components/ui/table";
import { STATE_LABEL } from "@/lib/collaboration/machine";
import { formatCents } from "@/lib/posts/metrics";
import { loadWallet, MEASUREMENT_WINDOW_DAYS } from "@/lib/wallet/queries";
import type { LedgerKind } from "@/lib/wallet/queries";
import { cn } from "@/lib/utils";

import { ReleaseDueForm, TopUpForm } from "./wallet-forms";

export const metadata = { title: "Wallet" };

const KIND_LABEL: Readonly<Record<LedgerKind, string>> = {
  topup: "Top-up",
  commit: "Committed",
  release: "Released",
  refund: "Refunded",
};

/**
 * The wallet and its ledger (SCOPE.md delivery step 9).
 *
 * The balance is a stored number; the ledger is what explains it. Both are on
 * screen because a balance nobody can reconcile is the same kind of unarguable
 * figure as a match score with no working shown.
 */
export default async function WalletPage() {
  const wallet = await loadWallet();

  if (!wallet) {
    return (
      <Page>
        <PageHeader title="Wallet" />
        {/* Not the same as a zero balance, and it must not read like one: a
            zero balance is fixed by topping up and this is not. */}
        <EmptyState title="This workspace has no wallet" className="mt-6">
          A workspace is created with an empty wallet, so this one predates that or
          had its wallet removed. There is nothing to commit a booking against, and
          topping up will not create it.
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page width="wide">
      <PageHeader
        title="Wallet"
        description="No money moves. A booking commits against the balance and closing releases it — the ledger is the record of both."
      />

      <MetricRow className="mt-6 sm:grid-cols-3">
        <Metric label="Balance" value={formatCents(wallet.balanceCents)} emphasis />
        <Metric
          label="Committed"
          value={formatCents(wallet.committedCents)}
          note="held against open bookings"
        />
        <Metric label="Entries" value={wallet.entries.length} />
      </MetricRow>

      <section className="mt-6 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          <SectionHeader
            title="Ledger"
            meta={`${wallet.entries.length} ${wallet.entries.length === 1 ? "entry" : "entries"}`}
          />

          {wallet.entries.length === 0 ? (
            <EmptyState title="Nothing recorded yet">
              Entries appear when you add funds or book a creator.
            </EmptyState>
          ) : (
            <TableFrame>
              <Table>
                <THead>
                  <TR>
                    <TH>Entry</TH>
                    <TH>Against</TH>
                    <TH numeric>Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {wallet.entries.map((entry) => (
                    <TR key={entry.id}>
                      <TD>
                        <Badge
                          variant={
                            entry.kind === "commit"
                              ? "neutral"
                              : entry.kind === "refund"
                                ? "warning"
                                : "positive"
                          }
                        >
                          {KIND_LABEL[entry.kind]}
                        </Badge>
                        <CellNote>
                          {new Date(entry.at).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </CellNote>
                      </TD>
                      <TD>
                        {entry.collaborationId ? (
                          <>
                            <Link
                              href={`/brand/collaborations/${entry.collaborationId}`}
                              className="underline-offset-4 outline-none hover:underline focus-visible:underline"
                            >
                              {entry.creatorName ?? "A collaboration"}
                            </Link>
                            <CellNote>
                              {entry.campaignName ?? "—"}
                              {entry.state ? ` · ${STATE_LABEL[entry.state]}` : ""}
                            </CellNote>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                      {/* Signed as stored. A commit reads as a negative because
                          that is what it did to the balance. */}
                      <TD
                        numeric
                        className={cn(
                          "font-medium",
                          entry.amountCents < 0 ? "text-foreground" : "text-positive",
                        )}
                      >
                        {entry.amountCents < 0 ? "−" : "+"}
                        {formatCents(Math.abs(entry.amountCents))}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add funds</CardTitle>
            </CardHeader>
            <CardBody>
              <TopUpForm />
            </CardBody>
          </Card>

          {wallet.dueCollaborationIds.length > 0 ? (
            <Callout tone="note">
              <p className="text-foreground">
                {wallet.dueCollaborationIds.length}{" "}
                {wallet.dueCollaborationIds.length === 1 ? "collaboration has" : "collaborations have"}{" "}
                passed the {MEASUREMENT_WINDOW_DAYS}-day measurement window. Closing
                releases what each one committed.
              </p>
              <div className="mt-3">
                <ReleaseDueForm collaborationIds={wallet.dueCollaborationIds} />
              </div>
            </Callout>
          ) : null}
        </div>
      </section>
    </Page>
  );
}
