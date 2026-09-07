import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { toAreaUpdate, updateAreaInput } from "@/lib/map/areaInput"

/**
 * Updates and removes an area.
 *
 * Every write is filtered by id AND manager_id AND kind='area'. RLS already
 * enforces the tenancy half; stating it here means a policy regression cannot
 * silently widen these endpoints, and the kind filter stops the map's endpoints
 * being turned on strategic initiatives.
 *
 * Postgres RLS narrows a row set rather than raising, so "zero rows affected"
 * is the only signal that a row was not the caller's — hence the 404 on an
 * empty result rather than a cheerful 200.
 */

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = updateAreaInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    )
  }

  const patch = toAreaUpdate(parsed.data)

  // Keep the retiring `domain` text column in step with the reference for the
  // one release it remains live (migration 044).
  if ("domain_id" in patch) {
    const domainId = patch.domain_id as string | null
    if (domainId === null) {
      patch.domain = null
    } else {
      const { data: domain } = await supabase
        .from("map_domains")
        .select("name")
        .eq("id", domainId)
        .eq("manager_id", user.id)
        .single()
      if (!domain) {
        return NextResponse.json({ error: "Domain not found." }, { status: 404 })
      }
      patch.domain = (domain as { name: string }).name
    }
  }

  const { data, error } = await supabase
    .from("strategic_initiatives")
    .update(patch)
    .eq("id", id)
    .eq("manager_id", user.id)
    .eq("kind", "area")
    .select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "Area not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Children go with the parent via parent_id's ON DELETE CASCADE. Migration
  // 041 guarantees every child belongs to the same manager, so the cascade
  // cannot reach outside this tenant.
  const { data, error } = await supabase
    .from("strategic_initiatives")
    .delete()
    .eq("id", id)
    .eq("manager_id", user.id)
    .eq("kind", "area")
    .select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "Area not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
