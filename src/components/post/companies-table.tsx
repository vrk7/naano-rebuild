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
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Country</th>
            <th className="px-4 py-3 text-right font-medium">Engaged</th>
            <th className="px-4 py-3 text-right font-medium">In ICP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {companies.map((company) => (
            <tr key={company.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{company.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{company.country ?? "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums">{company.engaged}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {company.matched > 0 ? (
                  company.matched
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
