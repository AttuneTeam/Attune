import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { moveDomainInput } from "@/lib/map/domainInput"

const INSUFFICIENT_PRIVILEGE = "42501"
const INVALID_PARAMETER = "22023"

type Context = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = moveDomainInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    )
  }

  const { error } = await supabase.rpc("move_domain", {
    p_domain_id: id,
    p_direction: parsed.data.direction,
  })

  if (error) {
    // move_domain runs as the caller, so another manager's domain is simply
    // invisible and indistinguishable from absent.
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return NextResponse.json({ error: "Domain not found." }, { status: 404 })
    }
    if (error.code === INVALID_PARAMETER) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
