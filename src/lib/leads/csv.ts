/**
 * CSV encoding for the leads export (PRODUCT.md step 14).
 *
 * Hand-rolled rather than a dependency: this is one escaping rule and a join,
 * and CLAUDE.md is against adding a library for something ten lines already do.
 *
 * The rule is RFC 4180. A field is quoted when it contains a comma, a quote, or
 * a newline, and an embedded quote is doubled. Getting this wrong does not
 * throw — it silently shifts every later column of that row under the wrong
 * header, which is why it has tests.
 */

const NEEDS_QUOTING = /[",\r\n]/;

export function escapeField(value: string): string {
  if (!NEEDS_QUOTING.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * A leading `=`, `+`, `-` or `@` makes a spreadsheet treat the cell as a
 * formula. These are names and company names out of a database, so the cell is
 * prefixed with a single quote to keep it text.
 *
 * The alternative — stripping the character — silently changes someone's name.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function neutraliseFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function toCsvRow(fields: ReadonlyArray<string>): string {
  return fields.map((field) => escapeField(neutraliseFormula(field))).join(",");
}

/**
 * Rows joined with CRLF and a trailing newline, which is what RFC 4180 asks for
 * and what Excel expects.
 */
export function toCsv(
  header: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): string {
  return [toCsvRow(header), ...rows.map(toCsvRow)].join("\r\n") + "\r\n";
}
