import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { moveAreaInput } from "@/lib/map/areaInput"

/**
 * Moves an area one place up or down within its group.
 *
 * The swap lives in the move_area database function (migration 043) so both
 * writes land in one transaction and two areas can never be seen sharing a
 * position. The function runs as the caller, so Row-Level Security is what
 * stops one manager reordering another's areas.
 *
 * This route's job is the auth guard, validating the direction, and turning the
 * function's SQLSTATEs into honest status codes.
 */

type Context = { params: Promise<{ id: string }> }

/** Raised by move_area when the area is absent or invisible under RLS. */
const INSUFFICIENT_PRIVILEGE = "42501"
/** Raised by move_area for a direction it does not recognise. */
const INVALID_PARAMETER = "22023"

export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = moveAreaInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    )
  }

  const { error } = await supabase.rpc("move_area", {
    p_area_id: id,
    p_direction: parsed.data.direction,
  })

  if (error) {
    // An area the caller cannot see is missing, not a server fault. Returning
    // 500 here would blame us for their request.
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return NextResponse.json({ error: "Area not found." }, { status: 404 })
    }
    if (error.code === INVALID_PARAMETER) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Already at the end of its group is a no-op, not a failure: the interface
  // disables the control, and the database is safe when asked anyway.
  return NextResponse.json({ ok: true })
}
