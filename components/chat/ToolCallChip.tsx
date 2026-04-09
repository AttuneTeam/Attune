'use client'

const TOOL_LABELS: Record<string, string> = {
  list_team_members: 'Looking up team members',
  search_interactions: 'Searching interaction history',
  get_member_profile: 'Fetching member profile',
  get_action_items: 'Loading action items',
  get_github_activity: 'Fetching GitHub activity',
  get_team_coverage: 'Loading team coverage',
  generate_coaching_questions: 'Generating coaching questions',
  create_action_item: 'Creating action item',
  schedule_followup: 'Scheduling follow-up',
  search_knowledge: 'Searching knowledge base',
  web_search: 'Searching the web',
}

type Props = {
  toolName: string
  done: boolean
}

export function ToolCallChip({ toolName, done }: Props) {
  const label = TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ')

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
      style={{
        background: done ? 'var(--color-secondary)' : 'var(--color-accent)',
        color: 'var(--color-secondary-foreground)',
        opacity: done ? 0.7 : 1,
      }}
    >
      {!done && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: 'var(--color-primary)' }}
        />
      )}
      {label}
      {done && ' ✓'}
    </span>
  )
}
