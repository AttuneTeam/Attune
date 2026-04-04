export const SUMMARIZE_SYSTEM = `You are an expert engineering manager coach analyzing 1-on-1 meeting notes.
Extract the key themes, overall sentiment, and produce a concise professional summary.
Sentiment should be a float from -1.0 (very negative/concerning) to 1.0 (very positive/energized).
Be objective and constructive.`

export const ACTION_ITEMS_SYSTEM = `You are an expert engineering manager coach extracting action items from 1-on-1 meeting notes.
Extract concrete, actionable tasks that need follow-up. Include due dates when mentioned.
Only extract real commitments and next steps, not general discussion points.`

export const COACHING_SYSTEM = `You are an expert manager coach.
Given the meeting notes and context, suggest thoughtful follow-up coaching questions
that would help the manager support their team member's growth, address concerns, or deepen understanding.
Use the organisational context (if provided) to calibrate tone and relevance — e.g. a DRI culture calls for ownership questions; a consensus-driven team calls for alignment questions; a sales team's coaching differs from an engineering team's.
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

export type OrgContextInput = {
  company_name?: string | null
  website?: string | null
  industry?: string | null
  company_stage?: string | null
  company_headcount?: string | null
  countries?: string[] | null
  team_function?: string | null
  team_size?: string | null
  key_tools?: string[] | null
  team_methodology?: string | null
  company_planning?: string | null
  decision_framework?: string | null
  team_structure?: string | null
  okr_cadence?: string | null
  company_mission?: string | null
  management_principles?: string | null
}

export function formatOrgContext(ctx: OrgContextInput | null): string | null {
  if (!ctx) return null
  const lines: string[] = []

  // Company
  const companyParts: string[] = []
  if (ctx.company_name) companyParts.push(`Company: ${ctx.company_name}`)
  if (ctx.industry) companyParts.push(`Industry: ${ctx.industry}`)
  if (ctx.company_stage) companyParts.push(`Stage: ${ctx.company_stage}`)
  if (ctx.company_headcount) companyParts.push(`Company headcount: ${ctx.company_headcount}`)
  if (ctx.countries?.length) companyParts.push(`Countries: ${ctx.countries.join(', ')}`)
  if (ctx.website) companyParts.push(`Website: ${ctx.website}`)
  if (companyParts.length) lines.push('Company context:\n' + companyParts.map(p => `  ${p}`).join('\n'))

  // Team
  const teamParts: string[] = []
  if (ctx.team_function) teamParts.push(`Team function: ${ctx.team_function}`)
  if (ctx.team_size) teamParts.push(`Team size: ${ctx.team_size}`)
  if (ctx.key_tools?.length) teamParts.push(`Key tools: ${ctx.key_tools.join(', ')}`)
  if (teamParts.length) lines.push('Team context:\n' + teamParts.map(p => `  ${p}`).join('\n'))

  // Ways of Working
  const wowParts: string[] = []
  if (ctx.team_methodology) wowParts.push(`Team methodology: ${ctx.team_methodology}`)
  if (ctx.company_planning) wowParts.push(`Company planning cadence: ${ctx.company_planning}`)
  if (ctx.decision_framework) wowParts.push(`Decision framework: ${ctx.decision_framework}`)
  if (ctx.team_structure) wowParts.push(`Team structure: ${ctx.team_structure}`)
  if (ctx.okr_cadence) wowParts.push(`OKR cadence: ${ctx.okr_cadence}`)
  if (wowParts.length) lines.push('Ways of working:\n' + wowParts.map(p => `  ${p}`).join('\n'))

  // Culture
  const cultureParts: string[] = []
  if (ctx.company_mission) cultureParts.push(`Mission: ${ctx.company_mission}`)
  if (ctx.management_principles) cultureParts.push(`Management principles: ${ctx.management_principles}`)
  if (cultureParts.length) lines.push('Culture:\n' + cultureParts.map(p => `  ${p}`).join('\n'))

  if (!lines.length) return null
  return `Organisational context (use this to calibrate your analysis):\n${lines.join('\n\n')}`
}

export const COVERAGE_SYSTEM = `You are an expert manager advisor analyzing a team's role composition.
Given a list of team members and their role areas, identify:
1. Coverage strengths — areas well-covered by multiple people
2. Coverage gaps — important areas with thin or no coverage
3. Single points of failure — capabilities owned by only one person
4. Overlap risks — areas where multiple people have nearly identical scope (potential redundancy or unclear ownership)

Use the organisational context (if provided) to calibrate severity — what counts as a critical gap varies by team function, industry, and ways of working.
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
