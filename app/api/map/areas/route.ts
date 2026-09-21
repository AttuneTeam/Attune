import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAreaInput } from "@/lib/map/areaInput"

/**
 * Creates an area on the Surface Area Map.
 *
 * Three things are the server's alone: manager_id comes from the session,
 * kind is forced to 'area', and depth is derived from the parent. Those are
 * the tenancy boundary and the area/initiative split, so the schema is strict
 * and a client that tries to set any of them gets a 400 rather than a silent
 * success.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // A malformed body is the caller's problem; letting json() throw would
  // surface it as a 500, which reads as ours.
  const body = await req.json().catch(() => null)
  const parsed = createAreaInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    )
  }

  const { title, domain_id = null, parent_id = null } = parsed.data

  let depth = 0
  if (parent_id) {
    const { data: parent } = await supabase
      .from("strategic_initiatives")
      .select("depth, kind")
      .eq("id", parent_id)
      // Scoped to the caller: without this a client could probe another
      // tenant's depth values through the response codes.
      .eq("manager_id", user.id)
      .single()

    if (!parent) {
      return NextResponse.json({ error: "Parent area not found." }, { status: 404 })
    }
    // Nothing in the database prevents this, but an area hanging off an
    // initiative renders correctly in neither lens.
    if (parent.kind !== "area") {
      return NextResponse.json(
        { error: "An area cannot sit under an initiative." },
        { status: 400 },
      )
    }
    if (parent.depth >= 2) {
      return NextResponse.json(
        { error: "Areas only nest two levels deep." },
        { status: 400 },
      )
    }
    depth = parent.depth + 1
  }

  // Resolve the domain name so the retiring `domain` text column stays in step
  // for the one release it remains live (migration 044). Scoped to the caller,
  // so a reference to another manager's domain is simply not found.
  let domainName: string | null = null
  if (domain_id) {
    const { data: domain } = await supabase
      .from("map_domains")
      .select("name")
      .eq("id", domain_id)
      .eq("manager_id", user.id)
      .single()
    if (!domain) {
      return NextResponse.json({ error: "Domain not found." }, { status: 404 })
    }
    domainName = (domain as { name: string }).name
  }

  const { data, error } = await supabase
    .from("strategic_initiatives")
    .insert({
      manager_id: user.id,
      kind: "area",
      title,
      domain_id,
      domain: domainName,
      parent_id,
      depth,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: (data as { id: string }).id })
}
