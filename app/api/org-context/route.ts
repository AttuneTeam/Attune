import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('org_context')
    .select('*')
    .eq('manager_id', user.id)
    .single()

  return NextResponse.json(data ?? null)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const allowed = [
    'company_name', 'website', 'industry', 'company_stage', 'company_headcount', 'countries',
    'team_function', 'team_size', 'key_tools',
    'team_methodology', 'company_planning', 'decision_framework', 'team_structure', 'okr_cadence',
    'company_mission', 'management_principles',
  ]

  const patch: Record<string, unknown> = { manager_id: user.id, updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await supabase
    .from('org_context')
    .upsert(patch, { onConflict: 'manager_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
