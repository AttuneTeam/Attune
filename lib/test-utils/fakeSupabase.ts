import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * A Supabase client that records what was asked of it instead of talking to a
 * database.
 *
 * The properties worth asserting about our queries and writes are structural:
 * which table, which operation, which filters, what payload, and — often most
 * importantly — how many round trips were made. A real database proves none of
 * those cheaply.
 *
 * This is deliberately not a substitute for tests/rls/. Anything that depends
 * on a policy actually being enforced belongs there, against real Postgres.
 * What lives here is the shape of the request the application makes.
 */

export type QueryResult = {
  data: unknown
  /** `code` carries the SQLSTATE, which routes map to HTTP status codes. */
  error: { message: string; code?: string } | null
}

export type RecordedQuery = {
  table: string
  op: "select" | "insert" | "update" | "delete"
  /** Column list passed to .select(), if any. */
  select: string | null
  /** Row(s) handed to .insert() or .update(). */
  payload: unknown
  filters: Array<{ column: string; value: unknown }>
  orders: Array<{ column: string; ascending?: boolean }>
  /** Set when the chain ended in .single() or .maybeSingle(). */
  single: boolean
}

export type RecordedRpc = { fn: string; args: unknown }

export type FakeSupabase = {
  client: SupabaseClient
  queries: RecordedQuery[]
  rpcs: RecordedRpc[]
}

export type FakeSupabaseOptions = {
  /** The signed-in user. Pass null to simulate an unauthenticated request. */
  user?: { id: string } | null
}

/**
 * `results` may be a single result reused by every query, or a queue consumed
 * one query at a time — which is what lets a route that looks up a parent and
 * then inserts be driven through both steps.
 */
export function fakeSupabase(
  results: QueryResult | QueryResult[],
  options: FakeSupabaseOptions = {},
): FakeSupabase {
  const queries: RecordedQuery[] = []
  const rpcs: RecordedRpc[] = []
  const queue = Array.isArray(results) ? [...results] : null
  const single = Array.isArray(results) ? null : results

  const nextResult = (): QueryResult => {
    if (single) return single
    return (
      queue!.shift() ?? {
        data: null,
        error: { message: "fakeSupabase: ran out of queued results" },
      }
    )
  }

  function chainFor(record: RecordedQuery) {
    const chain = {
      select(columns: string) {
        record.select = columns
        return chain
      },
      insert(payload: unknown) {
        record.op = "insert"
        record.payload = payload
        return chain
      },
      update(payload: unknown) {
        record.op = "update"
        record.payload = payload
        return chain
      },
      delete() {
        record.op = "delete"
        return chain
      },
      eq(column: string, value: unknown) {
        record.filters.push({ column, value })
        return chain
      },
      in(column: string, value: unknown) {
        record.filters.push({ column, value })
        return chain
      },
      order(column: string, opts?: { ascending?: boolean }) {
        record.orders.push({ column, ascending: opts?.ascending })
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
        return Promise.resolve(nextResult()).then(onfulfilled, onrejected)
      },
    }
    return chain
  }

  const client = {
    rpc(fn: string, args: unknown) {
      rpcs.push({ fn, args })
      return Promise.resolve(nextResult())
    },
    auth: {
      getUser: async () => ({
        data: { user: options.user === undefined ? { id: "manager-1" } : options.user },
        error: null,
      }),
    },
    from(table: string) {
      const record: RecordedQuery = {
        table,
        op: "select",
        select: null,
        payload: undefined,
        filters: [],
        orders: [],
        single: false,
      }
      queries.push(record)
      return chainFor(record)
    },
  }

  // The fake implements only the surface our code uses. Casting through unknown
  // keeps the production signatures honest — they take a real SupabaseClient —
  // without dragging in the full generic builder types.
  return { client: client as unknown as SupabaseClient, queries, rpcs }
}
