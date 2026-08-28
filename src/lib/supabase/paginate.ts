/**
 * Pages through a PostgREST query rather than trusting one response to be
 * complete.
 *
 * PostgREST caps a response at 1000 rows. A truncated list is the worst kind of
 * wrong here: fewer audience facets means a lower overlap and a lower score,
 * fewer engaged people means a flattering cost per person. Both fail quietly
 * and in the direction that looks good, so every list read goes through this.
 */

/** PostgREST's default `max-rows`. Anything at this count may have more behind it. */
export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllRows<T>(
  runPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await runPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} failed: ${error.message}`);
    if (!data) throw new Error(`${label} returned no data`);

    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}
