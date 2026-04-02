import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InteractionCard } from '@/components/meetings/InteractionCard'
import { SemanticSearch } from '@/components/meetings/SemanticSearch'

const TYPE_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Incidental', value: 'incidental' },
  { label: 'Note', value: 'note' },
  { label: 'Slack', value: 'slack' },
]

export default async function InteractionsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; type?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const memberFilter = params.member
  const typeFilter = params.type

  let query = supabase
    .from('interactions')
    .select(`
      id, scheduled_at, ai_summary, sentiment_score, key_themes, title, type,
      team_members (id, name, level)
    `)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })

  if (memberFilter) {
    query = query.eq('participant_id', memberFilter)
  }
  if (typeFilter) {
    query = query.eq('type', typeFilter)
  }

  const { data: interactions } = await query.limit(50)

  const { data: members } = await supabase
    .from('team_members')
    .select('id, name')
    .order('name')

  const baseUrl = memberFilter ? `/interactions?member=${memberFilter}` : '/interactions'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Interactions</h1>
      </div>

      <div className="space-y-4 mb-6">
        <SemanticSearch />

        {/* Type filter */}
        <div className="flex gap-2 flex-wrap">
          {TYPE_FILTERS.map(({ label, value }) => (
            <a
              key={label}
              href={value ? `${baseUrl}${memberFilter ? '&' : '?'}type=${value}` : baseUrl}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                typeFilter === value || (!typeFilter && value === undefined)
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Member filter */}
        {members && members.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <a
              href={typeFilter ? `/interactions?type=${typeFilter}` : '/interactions'}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                !memberFilter ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              All people
            </a>
            {members.map((m) => (
              <a
                key={m.id}
                href={`/interactions?member=${m.id}${typeFilter ? `&type=${typeFilter}` : ''}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  memberFilter === m.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                {m.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {!interactions || interactions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No interactions yet. Create one from the dashboard.</p>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction) => (
            <InteractionCard key={interaction.id} interaction={interaction as never} />
          ))}
        </div>
      )}
    </div>
  )
}
