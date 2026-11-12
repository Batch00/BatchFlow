// Rows requested per page. Must stay at or below the Supabase "Max rows" API
// setting, otherwise every page comes back short and paging stops after one.
export const PAGE_SIZE = 500

// Reads every row of a Supabase query by paging with .range() until a short
// page comes back. `makeQuery` must return a fresh query builder on each call,
// and that query must have a stable order ending in `id` so rows are neither
// skipped nor repeated between pages. Any page error returns { data: null, error }
// so a partial result is never mistaken for a complete one.
export async function fetchAll(makeQuery, pageSize = PAGE_SIZE) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }
}
