import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: initiativeId } = await params

  const { data, error } = await supabase
    .from('interaction_initiative_signals')
    .select(`
      id, signal, note, created_at,
      interactions (
        id, title, scheduled_at,
        team_members ( id, name )
      )
    `)
    .eq('initiative_id', initiativeId)
    .eq('manager_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
