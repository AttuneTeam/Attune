import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatMessagesToTiptapJson } from '@/lib/ai/markdownToTiptap'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    title,
    source_chat_id,
    messages,
    parent_id,
  }: {
    title?: string
    source_chat_id?: string
    messages?: Array<{ role: string; text: string }>
    parent_id?: string
  } = body

  let description = null
  if (messages && messages.length > 0) {
    description = chatMessagesToTiptapJson(messages)
  }

  let depth = 0
  if (parent_id) {
    const { data: parent } = await supabase
      .from('strategic_initiatives')
      .select('depth')
      .eq('id', parent_id)
      .eq('manager_id', user.id)
      .single()
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
    if (parent.depth >= 2) return NextResponse.json({ error: 'Max depth reached' }, { status: 400 })
    depth = parent.depth + 1
  }

  const { data, error } = await supabase
    .from('strategic_initiatives')
    .insert({
      manager_id: user.id,
      title: title ?? 'Untitled Initiative',
      description: description ?? null,
      source_chat_id: source_chat_id ?? null,
      parent_id: parent_id ?? null,
      depth,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id })
}
