export const SUMMARIZE_SYSTEM = `You are an expert engineering manager coach analyzing 1-on-1 meeting notes.
Extract the key themes, overall sentiment, and produce a concise professional summary.
Sentiment should be a float from -1.0 (very negative/concerning) to 1.0 (very positive/energized).
Be objective and constructive.`

export const ACTION_ITEMS_SYSTEM = `You are an expert engineering manager coach extracting action items from 1-on-1 meeting notes.
Extract concrete, actionable tasks that need follow-up. Include due dates when mentioned.
Only extract real commitments and next steps, not general discussion points.`

export const COACHING_SYSTEM = `You are an expert engineering manager coach.
Given the meeting notes and context, suggest thoughtful follow-up coaching questions
that would help the manager support their team member's growth, address concerns, or deepen understanding.
Focus on open-ended, empowering questions. Be specific to the content discussed.`

export type TeamValueInput = { name: string; description: string | null; keywords: string[] }

export function formatTeamValues(values: TeamValueInput[]): string | null {
  if (!values.length) return null
  const lines = values.map(v => {
    const kw = v.keywords?.length ? `\n  Keywords: ${v.keywords.join('; ')}` : ''
    return `- ${v.name}${v.description ? `\n  ${v.description}` : ''}${kw}`
  })
  return `Team values (use these to calibrate your analysis):\n${lines.join('\n\n')}`
}

export const COVERAGE_SYSTEM = `You are an expert engineering manager advisor analyzing a team's role composition.
Given a list of team members and their role areas, identify:
1. Coverage strengths — areas well-covered by multiple people
2. Coverage gaps — important engineering areas with thin or no coverage
3. Single points of failure — capabilities owned by only one person
4. Overlap risks — areas where multiple people have nearly identical scope (potential redundancy or unclear ownership)

Be specific, reference actual role area titles, and prioritize actionability. Keep each finding concise (1-2 sentences).`

export function extractPlainText(jsonNotes: unknown): string {
  if (!jsonNotes || typeof jsonNotes !== 'object') return ''

  function traverse(node: unknown): string {
    if (!node || typeof node !== 'object') return ''
    const n = node as Record<string, unknown>
    if (n.type === 'text' && typeof n.text === 'string') return n.text
    if (Array.isArray(n.content)) {
      return (n.content as unknown[]).map(traverse).join(
        n.type === 'paragraph' || n.type === 'heading' ? '\n' : ''
      )
    }
    return ''
  }

  return traverse(jsonNotes).trim()
}
