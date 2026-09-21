import type { SupabaseClient } from "@supabase/supabase-js"
import type { SignalType } from "@/lib/supabase/types"

/**
 * The conversations that touched an area.
 *
 * This is the join that makes the map Attune's rather than a generic outline.
 * Migration 040 already records whether an interaction advanced, reinforced or
 * threatened an initiative, and an area is a row in the same table — so the
 * manager's own 1-on-1 notes feed the map without anyone entering anything
 * twice.
 *
 * Per FR6 these signals are context on the area detail. They deliberately do
 * not feed the attention mark, which stays staleness and ownership only.
 */

export type LinkedInteraction = {
  interactionId: string
  title: string | null
  participantName: string | null
  signal: SignalType
  note: string | null
  occurredAt: string | null
}

/** The participant is resolved in the same query — a name per signal would be an N+1. */
export const LINKED_INTERACTION_SELECT = [
  "signal",
  "note",
  "created_at",
  "interaction:interactions(id, title, scheduled_at, participant:team_members(id, name))",
].join(", ")

/** PostgREST returns a to-one embed as an object, or an array when it cannot infer cardinality. */
type Embedded<T> = T | T[] | null

type RawParticipant = { id: string; name: string | null }
type RawInteraction = {
  id: string
  title: string | null
  scheduled_at: string | null
  participant: Embedded<RawParticipant>
}
type RawSignal = {
  signal: SignalType
  note: string | null
  created_at: string
  interaction: Embedded<RawInteraction>
}

function one<T>(value: Embedded<T>): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * Returns an empty list on failure rather than surfacing an error.
 *
 * Unlike the map's own list, this is additive context: losing it must not stop
 * the manager reading or editing the area itself. An area with no linked
 * conversations and an area whose context failed to load look the same, which
 * is acceptable here precisely because nothing is claimed by its absence.
 */
export async function fetchLinkedInteractions(
  supabase: SupabaseClient,
  areaId: string,
  managerId: string,
): Promise<LinkedInteraction[]> {
  const { data } = await supabase
    .from("interaction_initiative_signals")
    .select(LINKED_INTERACTION_SELECT)
    .eq("initiative_id", areaId)
    // RLS already scopes this; stating it keeps the intent at the call site.
    .eq("manager_id", managerId)
    // Freshest first: the panel is read top-down when preparing to talk to
    // someone, so the most recent signal must be the one in view.
    .order("created_at", { ascending: false })

  const rows = (data ?? []) as unknown as RawSignal[]

  return rows.flatMap((row) => {
    const interaction = one(row.interaction)
    // A signal without its conversation is meaningless, and a link to nothing
    // would be worse than omitting the row.
    if (!interaction) return []

    const participant = one(interaction.participant)
    return [
      {
        interactionId: interaction.id,
        title: interaction.title,
        participantName: participant?.name ?? null,
        signal: row.signal,
        note: row.note,
        occurredAt: interaction.scheduled_at,
      },
    ]
  })
}
