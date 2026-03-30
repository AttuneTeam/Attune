import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { extractPlainText, ACTION_ITEMS_SYSTEM } from '@/lib/ai/prompts'

export async function POST(request: NextRequest) {
  try {
    const { meetingId } = await request.json()
    if (!meetingId) return NextResponse.json({ error: 'meetingId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, raw_json_notes, manager_id')
      .eq('id', meetingId)
      .single()

    if (!meeting || meeting.manager_id !== user.id) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const notesText = extractPlainText(meeting.raw_json_notes)
    if (!notesText || notesText.length < 20) {
      return NextResponse.json({ error: 'Notes too short', count: 0 }, { status: 400 })
    }

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      system: ACTION_ITEMS_SYSTEM,
      prompt: `Meeting notes:\n\n${notesText}`,
      schema: z.object({
        items: z.array(z.object({
          description: z.string().describe('Clear, actionable task description'),
          due_date: z.string().nullable().describe('ISO date string (YYYY-MM-DD) if mentioned, null otherwise'),
        })).describe('List of action items extracted from the meeting'),
      }),
    })

    if (object.items.length === 0) {
      return NextResponse.json({ count: 0, message: 'No action items found' })
    }

    // Insert action items (don't duplicate — delete existing AI-generated ones first)
    const rows = object.items.map((item) => ({
      meeting_id: meetingId,
      description: item.description,
      status: 'open' as const,
      due_date: item.due_date ?? null,
    }))

    const { error } = await supabase.from('action_items').insert(rows)
    if (error) {
      console.error('Insert action items error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: rows.length })
  } catch (error) {
    console.error('Action items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
