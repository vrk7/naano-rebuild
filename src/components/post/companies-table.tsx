import { TableFrame, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { CompanyRollup } from "@/lib/posts/metrics";

export function CompaniesTable({ companies }: { companies: ReadonlyArray<CompanyRollup> }) {
  if (companies.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No companies resolved for the people who engaged.
      </p>
    );
  }

  return (
    <TableFrame className="mt-4">
      <Table>
        <THead>
          <TR>
            <TH>Company</TH>
            <TH>Country</TH>
            <TH numeric>Engaged</TH>
            <TH numeric>In ICP</TH>
          </TR>
        </THead>
        <TBody>
          {companies.map((company) => (
            <TR key={company.id} interactive>
              <TD className="font-medium">{company.name}</TD>
              <TD className="text-muted-foreground">{company.country ?? "—"}</TD>
              <TD numeric>{company.engaged}</TD>
              {/* A zero is greyed rather than hidden: the row is here because
                  the company engaged, and "none of them were yours" is the
                  answer, not a missing value. */}
              <TD numeric className={company.matched === 0 ? "text-muted-foreground" : undefined}>
                {company.matched}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}
