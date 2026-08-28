import { ICP_MATCH_THRESHOLD } from "@/lib/score/weights";
import { bestScore, isMatched, type EngagedPerson } from "@/lib/posts/metrics";

/**
 * PRODUCT.md step 13: "name, role, seniority, company, which ICP they match and
 * at what score".
 *
 * Low scores are shown rather than hidden. A table that only ever displays
 * matches is the same lie as a score that is always 100 — the point of the page
 * is that a brand can see who a post actually reached, including the people it
 * had no use for.
 */
export function PeopleTable({ people }: { people: ReadonlyArray<EngagedPerson> }) {
  if (people.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Nobody has engaged with this post yet.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Person</th>
            <th className="px-4 py-3 font-medium">Seniority</th>
            <th className="px-4 py-3 font-medium">Company</th>
            {/* "Closest", not "matching": this column is populated for people
                below the threshold too, and calling their nearest ICP a match is
                exactly the overclaim this page exists to avoid. */}
            <th className="px-4 py-3 font-medium">Closest ICP</th>
            <th className="px-4 py-3 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {people.map((person) => {
            const score = bestScore(person);
            const matched = isMatched(person);
            const best = person.matches[0];

            return (
              <tr key={person.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <span className="font-medium">{person.fullName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {person.roleTitle ?? "—"}
                    {person.engagementKinds.length > 1
                      ? ` · ${person.engagementKinds.join(", ")}`
                      : ""}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{person.seniority ?? "—"}</td>
                <td className="px-4 py-3">
                  {person.companyName ?? <span className="text-muted-foreground">—</span>}
                  {person.companyCountry ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {person.companyCountry}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {best ? (
                    <span className={matched ? "" : "text-muted-foreground"}>
                      {best.icpLabel}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No ICP scored</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={
                      matched
                        ? "rounded-md bg-brand-soft px-2 py-0.5 font-medium tabular-nums"
                        : "tabular-nums text-muted-foreground"
                    }
                    title={
                      matched
                        ? undefined
                        : `Below the ${ICP_MATCH_THRESHOLD} threshold for counting as a match`
                    }
                  >
                    {score}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
