import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * A Supabase client that records the builder chain instead of talking to a
 * database.
 *
 * The properties worth asserting about our list queries are structural: which
 * table, which filters, which ordering, and — most importantly — how many
 * queries were issued. A real database proves none of those cheaply, and a
 * mocked one that silently accepted a wrong filter would prove the opposite of
 * what we want. Shape assertions belong here; behaviour against real RLS
 * belongs in tests/rls/.
 */

export type QueryResult = { data: unknown; error: { message: string } | null }

export type RecordedQuery = {
  table: string
  select: string | null
  filters: Array<{ column: string; value: unknown }>
  orders: Array<{ column: string; ascending?: boolean }>
  /** Set when the chain ended in .single() or .maybeSingle(). */
  single: boolean
}

export type FakeSupabase = {
  client: SupabaseClient
  queries: RecordedQuery[]
}

export function fakeSupabase(result: QueryResult): FakeSupabase {
  const queries: RecordedQuery[] = []

  function chainFor(record: RecordedQuery) {
    const chain = {
      select(columns: string) {
        record.select = columns
        return chain
      },
      eq(column: string, value: unknown) {
        record.filters.push({ column, value })
        return chain
      },
      order(column: string, options?: { ascending?: boolean }) {
        record.orders.push({ column, ascending: options?.ascending })
        return chain
      },
      single() {
        record.single = true
        return chain
      },
      maybeSingle() {
        record.single = true
        return chain
      },
      then<TResult1, TResult2 = never>(
        onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(result).then(onfulfilled, onrejected)
      },
    }
    return chain
  }

  const client = {
    from(table: string) {
      const record: RecordedQuery = {
        table,
        select: null,
        filters: [],
        orders: [],
        single: false,
      }
      queries.push(record)
      return chainFor(record)
    },
  }

  // The fake implements only the surface our queries use. Casting through
  // unknown keeps the production signatures honest — they take a real
  // SupabaseClient — without dragging in the full generic builder types.
  return { client: client as unknown as SupabaseClient, queries }
}
