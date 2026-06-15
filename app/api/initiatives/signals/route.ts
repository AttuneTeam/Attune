import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SignalType } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { interactionId, initiativeId, signal, note } = await req.json() as {
    interactionId: string
    initiativeId: string
    signal: SignalType
    note?: string
  }

  if (!interactionId || !initiativeId || !signal) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('interaction_initiative_signals')
    .upsert(
      {
        interaction_id: interactionId,
        initiative_id: initiativeId,
        signal,
        note: note ?? null,
        manager_id: user.id,
      },
      { onConflict: 'interaction_id,initiative_id' }
    )
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { interactionId, initiativeId } = await req.json() as {
    interactionId: string
    initiativeId: string
  }

  const { error } = await supabase
    .from('interaction_initiative_signals')
    .delete()
    .eq('interaction_id', interactionId)
    .eq('initiative_id', initiativeId)
    .eq('manager_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
