import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { extractPlainText, COACHING_SYSTEM } from '@/lib/ai/prompts'

export async function POST(request: NextRequest) {
  try {
    const { interactionId } = await request.json()
    if (!interactionId) return NextResponse.json({ error: 'interactionId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: interaction } = await supabase
      .from('interactions')
      .select(`
        id, raw_json_notes, ai_summary, manager_id,
        team_members (name, level, role_description)
      `)
      .eq('id', interactionId)
      .single()

    if (!interaction || interaction.manager_id !== user.id) {
      return NextResponse.json({ error: 'Interaction not found' }, { status: 404 })
    }

    // Get last 3 interactions with this person for context
    const { data: pastInteractions } = await supabase
      .from('interactions')
      .select('ai_summary, scheduled_at')
      .eq('participant_id', (interaction as any).team_members?.id ?? '')
      .neq('id', interactionId)
      .order('scheduled_at', { ascending: false })
      .limit(3)

    const notesText = extractPlainText(interaction.raw_json_notes)
    const member = (interaction as any).team_members

    const contextParts = [
      `Team member: ${member?.name ?? 'Unknown'} (${member?.level ?? 'unknown level'})`,
      member?.role_description ? `Role: ${member.role_description}` : null,
      `\nCurrent interaction notes:\n${notesText}`,
      interaction.ai_summary ? `\nInteraction summary: ${interaction.ai_summary}` : null,
      pastInteractions && pastInteractions.length > 0
        ? `\nRecent interaction context:\n${pastInteractions.map((m, i) => `${i + 1}. ${m.ai_summary ?? '(no summary)'}`).join('\n')}`
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
