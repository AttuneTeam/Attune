import type { StrategicInitiative } from "@/lib/supabase/types"

/** The owner shown on an area row — a team member or stakeholder. */
export type AreaOwner = {
  id: string
  name: string
}

/**
 * One area as the map needs it.
 *
 * A narrow projection rather than the whole row: the map's list query runs over
 * every area a manager has, and `description` is a Tiptap JSONB document that
 * only the detail panel reads. Pulling it into the list would move kilobytes
 * per row for nothing.
 */
export type MapArea = Pick<
  StrategicInitiative,
  | "id"
  | "title"
  | "domain"
  | "parent_id"
  | "depth"
  | "kind"
  | "confidence"
  | "last_reviewed_at"
  | "created_at"
  | "owner_id"
> & {
  /** Resolved in the same query as the area — see FR2's single-query rule. */
  owner: AreaOwner | null
}
