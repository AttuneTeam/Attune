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
  }: {
    title?: string
    source_chat_id?: string
    messages?: Array<{ role: string; text: string }>
  } = body

  let description = null
  if (messages && messages.length > 0) {
    description = chatMessagesToTiptapJson(messages)
  }

  const { data, error } = await supabase
    .from('strategic_initiatives')
    .insert({
      manager_id: user.id,
      title: title ?? 'Untitled Strategy',
      description: description ?? null,
      source_chat_id: source_chat_id ?? null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id })
}
