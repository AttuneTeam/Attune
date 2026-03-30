import { createClient } from '@/lib/supabase/server'
import { TeamMemberCard } from '@/components/dashboard/TeamMemberCard'
import { redirect } from 'next/navigation'
import { differenceInDays, parseISO } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all direct reports
  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .order('name')

  if (!members || members.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Welcome! Add your team members to get started.
        </p>
        <a
          href="/team"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Add team members
        </a>
      </div>
    )
  }

  // For each member, fetch their most recent meeting + last 6 sentiment scores
  const memberData = await Promise.all(
    members.map(async (member) => {
      const { data: recentInteractions } = await supabase
        .from('interactions')
        .select('id, scheduled_at, sentiment_score')
        .eq('participant_id', member.id)
        .order('scheduled_at', { ascending: false })
        .limit(6)

      const lastInteraction = recentInteractions?.[0] ?? null
      const daysSince = lastInteraction
        ? differenceInDays(new Date(), parseISO(lastInteraction.scheduled_at))
        : null

      const sentimentHistory = (recentInteractions ?? [])
        .filter((m) => m.sentiment_score !== null)
        .reverse()
        .map((m) => m.sentiment_score as number)

      return { member, lastInteraction, daysSince, sentimentHistory }
    })
  )

  // Stats
  const { count: openItemsCount } = await supabase
    .from('action_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)
  const { count: meetingsThisMonth } = await supabase
    .from('interactions')
    .select('*', { count: 'exact', head: true })
    .gte('scheduled_at', thisMonthStart.toISOString())

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Interactions this month</p>
          <p className="text-3xl font-bold">{meetingsThisMonth ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Open action items</p>
          <p className="text-3xl font-bold">{openItemsCount ?? 0}</p>
        </div>
      </div>

      {/* Team member cards */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
        Direct Reports ({members.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {memberData.map(({ member, lastInteraction, daysSince, sentimentHistory }) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            lastInteractionId={lastInteraction?.id ?? null}
            daysSince={daysSince}
            sentimentHistory={sentimentHistory}
          />
        ))}
      </div>
    </div>
  )
}
