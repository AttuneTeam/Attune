import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MeetingCard } from '@/components/meetings/MeetingCard'
import { SemanticSearch } from '@/components/meetings/SemanticSearch'

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const memberFilter = params.member

  let query = supabase
    .from('meetings')
    .select(`
      id, scheduled_at, ai_summary, sentiment_score, key_themes, title,
      team_members (id, name, level)
    `)
    .order('scheduled_at', { ascending: false })

  if (memberFilter) {
    query = query.eq('participant_id', memberFilter)
  }

  const { data: meetings } = await query.limit(50)

  const { data: members } = await supabase
    .from('team_members')
    .select('id, name')
    .order('name')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Meetings</h1>
      </div>

      <div className="space-y-4 mb-6">
        <SemanticSearch />
        {members && members.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <a
              href="/meetings"
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                !memberFilter ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              All
            </a>
            {members.map((m) => (
              <a
                key={m.id}
                href={`/meetings?member=${m.id}`}
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

      {!meetings || meetings.length === 0 ? (
        <p className="text-muted-foreground text-sm">No meetings yet. Create one from the dashboard.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting as never} />
          ))}
        </div>
      )}
    </div>
  )
}
