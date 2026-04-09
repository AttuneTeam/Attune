import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedKnowledgeDocument } from '@/lib/ai/knowledge'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id, title, source, created_at, updated_at')
    .eq('manager_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, source } = await request.json()

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
  }

  const { data: doc, error } = await supabase
    .from('knowledge_documents')
    .insert({
      manager_id: user.id,
      title: title.trim(),
      content: content.trim(),
      source: source?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !doc) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Embed asynchronously — don't block the response
  embedKnowledgeDocument(doc.id, user.id, content.trim()).catch((err) =>
    console.error('[knowledge] embed error:', err)
  )

  return NextResponse.json({ id: doc.id })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', id)
    .eq('manager_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
