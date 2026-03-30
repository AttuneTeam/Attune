import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { extractPlainText, SUMMARIZE_SYSTEM } from '@/lib/ai/prompts'
import { embedMeeting } from '@/lib/ai/embeddings'

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
      return NextResponse.json({ error: 'Notes too short to summarize' }, { status: 400 })
    }

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      system: SUMMARIZE_SYSTEM,
      prompt: `Meeting notes:\n\n${notesText}`,
      schema: z.object({
        summary: z.string().describe('A concise 2-4 sentence summary of the meeting'),
        sentiment: z.number().min(-1).max(1).describe('Overall sentiment score from -1 to 1'),
        keyThemes: z.array(z.string()).max(5).describe('Key themes or topics discussed'),
      }),
    })

    // Update meeting row
    await supabase
      .from('meetings')
      .update({
        ai_summary: object.summary,
        sentiment_score: object.sentiment,
        key_themes: object.keyThemes,
      })
      .eq('id', meetingId)

    // Trigger embedding pipeline asynchronously (don't await — fire & forget)
    embedMeeting(meetingId, meeting.raw_json_notes).catch(console.error)

    return NextResponse.json({
      summary: object.summary,
      sentiment: object.sentiment,
      keyThemes: object.keyThemes,
    })
  } catch (error) {
    console.error('Summarize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
