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
import { cn } from "@/lib/utils";
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
    <TableFrame className="mt-4">
      <Table>
        <THead>
          <TR>
            <TH>Person</TH>
            <TH>Seniority</TH>
            <TH>Company</TH>
            {/* "Closest", not "matching": this column is populated for people
                below the threshold too, and calling their nearest ICP a match is
                exactly the overclaim this page exists to avoid. */}
            <TH>Closest ICP</TH>
            <TH numeric>Score</TH>
          </TR>
        </THead>
        <TBody>
          {people.map((person) => {
            const score = bestScore(person);
            const matched = isMatched(person);
            const best = person.matches[0];

            return (
              <TR key={person.id} interactive>
                <TD>
                  <span className="font-medium">{person.fullName}</span>
                  <CellNote>
                    {person.roleTitle ?? "—"}
                    {person.engagementKinds.length > 1
                      ? ` · ${person.engagementKinds.join(", ")}`
                      : ""}
                  </CellNote>
                </TD>
                <TD className="text-muted-foreground">{person.seniority ?? "—"}</TD>
                <TD>
                  {person.companyName ?? <span className="text-muted-foreground">—</span>}
                  {person.companyCountry ? (
                    <CellNote>{person.companyCountry}</CellNote>
                  ) : null}
                </TD>
                <TD className={matched ? undefined : "text-muted-foreground"}>
                  {best ? best.icpLabel : "No ICP scored"}
                </TD>
                {/* Above the threshold the figure gets weight, below it goes
                    quiet. No fill either way — a column of tinted chips stops
                    being a column of numbers you can read down. */}
                <TD
                  numeric
                  className={cn(
                    "font-medium",
                    matched ? "text-foreground" : "font-normal text-muted-foreground",
                  )}
                  title={
                    matched
                      ? undefined
                      : `Below the ${ICP_MATCH_THRESHOLD} threshold for counting as a match`
                  }
                >
                  {score}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}
