import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchLinkedInteractions } from "@/lib/map/linkedInteractions"

/**
 * Everything the area detail panel needs, in one request.
 *
 * The map's list query omits `description` on purpose — a Tiptap document per
 * row would move kilobytes across the whole map for something only this panel
 * reads. Fetching it here, alongside the linked conversations, keeps the list
 * light and the panel to a single round trip from the browser.
 */

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: area } = await supabase
    .from("strategic_initiatives")
    .select("description")
    .eq("id", id)
    .eq("manager_id", user.id)
    .eq("kind", "area")
    .single()

  if (!area) return NextResponse.json({ error: "Area not found." }, { status: 404 })

  const linked = await fetchLinkedInteractions(supabase, id, user.id)

  return NextResponse.json({
    description: (area as { description: unknown }).description,
    linked,
  })
}
