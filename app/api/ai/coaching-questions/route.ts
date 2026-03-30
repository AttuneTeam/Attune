import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { extractPlainText, COACHING_SYSTEM } from '@/lib/ai/prompts'

export async function POST(request: NextRequest) {
  try {
    const { meetingId } = await request.json()
    if (!meetingId) return NextResponse.json({ error: 'meetingId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: meeting } = await supabase
      .from('meetings')
      .select(`
        id, raw_json_notes, ai_summary, manager_id,
        team_members (name, level, role_description)
      `)
      .eq('id', meetingId)
      .single()

    if (!meeting || meeting.manager_id !== user.id) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Get last 3 meetings with this person for context
    const { data: pastMeetings } = await supabase
      .from('meetings')
      .select('ai_summary, scheduled_at')
      .eq('participant_id', (meeting as any).team_members?.id ?? '')
      .neq('id', meetingId)
      .order('scheduled_at', { ascending: false })
      .limit(3)

    const notesText = extractPlainText(meeting.raw_json_notes)
    const member = (meeting as any).team_members

    const contextParts = [
      `Team member: ${member?.name ?? 'Unknown'} (${member?.level ?? 'unknown level'})`,
      member?.role_description ? `Role: ${member.role_description}` : null,
      `\nCurrent meeting notes:\n${notesText}`,
      meeting.ai_summary ? `\nMeeting summary: ${meeting.ai_summary}` : null,
      pastMeetings && pastMeetings.length > 0
        ? `\nRecent meeting context:\n${pastMeetings.map((m, i) => `${i + 1}. ${m.ai_summary ?? '(no summary)'}`).join('\n')}`
        : null,
    ].filter(Boolean).join('\n')

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      system: COACHING_SYSTEM,
      prompt: contextParts,
      schema: z.object({
        questions: z.array(z.string()).min(3).max(5).describe('Coaching questions for the manager to ask'),
      }),
    })

    return NextResponse.json({ questions: object.questions })
  } catch (error) {
    console.error('Coaching questions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
