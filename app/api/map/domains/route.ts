import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createDomainInput } from "@/lib/map/domainInput"

/** Postgres unique_violation — this manager already has a domain by that name. */
const UNIQUE_VIOLATION = "23505"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createDomainInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("map_domains")
    .insert({ manager_id: user.id, name: parsed.data.name })
    .select("id, name")
    .single()

  if (error) {
    // Their situation to resolve, not our fault — 409 rather than 500.
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: "You already have a domain with that name." },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
