import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { renameDomainInput } from "@/lib/map/domainInput"

const UNIQUE_VIOLATION = "23505"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = renameDomainInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("map_domains")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("manager_id", user.id)
    .select("id")

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: "You already have a domain with that name." },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "Domain not found." }, { status: 404 })
  }

  // The `domain` text column is still live for one release (migration 044).
  // Leaving it stale would make a rename invisible to anything still reading
  // it, including the deployed app during the migration window.
  await supabase
    .from("strategic_initiatives")
    .update({ domain: parsed.data.name })
    .eq("domain_id", id)
    .eq("manager_id", user.id)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Clear the retiring text column first, while domain_id still points here.
  // The foreign key is ON DELETE SET NULL, so after the delete these rows are
  // no longer findable by domain_id.
  await supabase
    .from("strategic_initiatives")
    .update({ domain: null })
    .eq("domain_id", id)
    .eq("manager_id", user.id)

  const { data, error } = await supabase
    .from("map_domains")
    .delete()
    .eq("id", id)
    .eq("manager_id", user.id)
    .select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "Domain not found." }, { status: 404 })
  }

  // The areas themselves survive, ungrouped — losing a heading must never lose
  // the territory filed under it.
  return NextResponse.json({ ok: true })
}
