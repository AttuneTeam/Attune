import type { SupabaseClient } from "@supabase/supabase-js"
import type { StrategicInitiative } from "@/lib/supabase/types"

/**
 * Queries for the strategic-initiatives lens.
 *
 * /initiatives and /map read the same table and are separated only by `kind`
 * (migration 042). Both lenses must filter, or they bleed into each other: the
 * manager's strategic work fills up with onboarding areas, or the map sprouts
 * initiatives it never captured.
 *
 * Extracted from the page and the editor so the filter is assertable. It read
 * correctly before this existed only because kind defaults to 'initiative' —
 * true right up until the first area is created.
 */

/** Columns the initiatives editor needs for a child row. */
export const INITIATIVE_CHILD_SELECT = [
  "id",
  "title",
  "status",
  "updated_at",
  "depth",
  "parent_id",
  "manager_id",
  "description",
  "tags",
  "domain",
  "horizon",
  "source_chat_id",
  "created_at",
  "kind",
  "confidence",
  "last_reviewed_at",
  "owner_id",
].join(", ")

/**
 * Every initiative the manager owns, ordered exactly as the page's original
 * inline query was. Returns [] on failure, preserving the page's existing
 * behaviour — tightening that is a separate decision, not a side effect of
 * adding a filter.
 */
export async function fetchInitiatives(
  supabase: SupabaseClient,
  managerId: string,
): Promise<StrategicInitiative[]> {
  const { data } = await supabase
    .from("strategic_initiatives")
    .select("*")
    .eq("manager_id", managerId)
    .eq("kind", "initiative")
    .order("depth", { ascending: true })
    .order("created_at", { ascending: true })

  return (data ?? []) as unknown as StrategicInitiative[]
}

/**
 * An initiative's direct children.
 *
 * Scoped by manager_id through RLS rather than explicitly: this runs from the
 * browser client, where the session is the only identity available.
 */
export async function fetchInitiativeChildren(
  supabase: SupabaseClient,
  parentId: string,
): Promise<StrategicInitiative[]> {
  const { data } = await supabase
    .from("strategic_initiatives")
    .select(INITIATIVE_CHILD_SELECT)
    .eq("parent_id", parentId)
    .eq("kind", "initiative")
    .order("created_at", { ascending: true })

  return (data ?? []) as unknown as StrategicInitiative[]
}
