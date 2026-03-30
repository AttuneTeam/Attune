import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format, differenceInDays, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, Mail, Briefcase, Check, Clock, Circle, ExternalLink, Zap } from 'lucide-react'
import { SentimentInsightsCard } from '@/components/team/SentimentInsightsCard'
import { MemberEditButton } from '@/components/team/MemberEditButton'
import { NewInteractionButton } from '@/components/dashboard/NewMeetingButton'

type InteractionRow = {
  id: string
  title: string | null
  scheduled_at: string
  sentiment_score: number | null
  ai_summary: string | null
  key_themes: string[]
  type: string
}

function sentimentBadge(score: number): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (score >= 0.3) return { label: 'Positive', variant: 'default' }
  if (score >= -0.3) return { label: 'Neutral', variant: 'secondary' }
  return { label: 'Concerning', variant: 'destructive' }
}

function topThemes(interactions: InteractionRow[]): string[] {
  const counts: Record<string, number> = {}
  for (const m of interactions) {
    for (const theme of (m.key_themes ?? [])) {
      counts[theme] = (counts[theme] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme]) => theme)
}

function generateNudges(
  interactions: InteractionRow[],
  openCount: number,
  daysSince: number | null,
): string[] {
  const nudges: string[] = []
  const withScore = interactions.filter((m) => m.sentiment_score !== null)

  if (daysSince !== null && daysSince > 21) {
    nudges.push(`It's been ${daysSince} days since the last 1-on-1 — consider scheduling one soon.`)
  }

  if (withScore.length >= 2) {
    const recent = withScore.slice(0, 3).map((m) => m.sentiment_score as number)
    const prior = withScore.slice(3, 6).map((m) => m.sentiment_score as number)
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length

    if (prior.length > 0) {
      const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length
      if (recentAvg < priorAvg - 0.2) {
        nudges.push('Sentiment has been trending downward — explore what might be causing this shift.')
      } else if (recentAvg > priorAvg + 0.2) {
        nudges.push('Sentiment is improving — a good time to discuss growth and new challenges.')
      }
    }

    if (recentAvg < -0.2) {
      nudges.push('Recent interactions suggest lower engagement — consider discussing workload, blockers, or wellbeing.')
    } else if (recentAvg > 0.5) {
      nudges.push('Strong positive energy — consider exploring stretch goals or leadership opportunities.')
    }
  }

  if (openCount >= 5) {
    nudges.push(`${openCount} open action items — worth reviewing for blockers in the next session.`)
  }

  if (nudges.length === 0 && withScore.length > 0) {
    nudges.push('Sentiment looks stable. Use your next session to explore long-term career goals.')
  }

  return nudges.slice(0, 3)
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) notFound()

  const { data: teams } = await supabase.from('teams').select('*').order('name')

  const { data: interactionsRaw } = await supabase
    .from('interactions')
    .select('id, title, scheduled_at, sentiment_score, ai_summary, key_themes, type')
    .eq('participant_id', id)
    .order('scheduled_at', { ascending: false })

  const interactions = (interactionsRaw ?? []) as InteractionRow[]
  const interactionIds = interactions.map((m) => m.id)

  const { data: actionItems } = interactionIds.length > 0
    ? await supabase
        .from('action_items')
        .select('*')
        .in('interaction_id', interactionIds)
        .order('created_at', { ascending: false })
    : { data: [] as Awaited<ReturnType<typeof supabase.from>>['data'] }

  const items = (actionItems ?? []) as Array<{
    id: string; description: string; status: string; due_date: string | null; interaction_id: string
  }>

  // Derived
  const lastInteraction = interactions[0] ?? null
  const daysSince = lastInteraction
    ? differenceInDays(new Date(), parseISO(lastInteraction.scheduled_at))
    : null

  const withScore = interactions.filter((m) => m.sentiment_score !== null)
  const avgSentiment = withScore.length > 0
    ? withScore.reduce((sum, m) => sum + (m.sentiment_score as number), 0) / withScore.length
    : null

  const sentimentHistory = [...interactions]
    .filter((m) => m.sentiment_score !== null)
    .reverse()
    .map((m) => ({ date: m.scheduled_at, score: m.sentiment_score as number }))

  const themes = topThemes(interactions)
  const openCount = items.filter((i) => i.status === 'open').length
  const nudges = generateNudges(interactions, openCount, daysSince)

  const openItems = items.filter((i) => i.status === 'open')
  const inProgressItems = items.filter((i) => i.status === 'in_progress')
  const doneItems = items.filter((i) => i.status === 'done')

  const teamName = teams?.find((t) => t.id === member.team_id)?.name ?? null

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/team"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Team
        </Link>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-bold truncate">{member.name}</h1>
          {member.level && (
            <Badge variant="secondary" className="capitalize shrink-0">{member.level}</Badge>
          )}
          {teamName && (
            <Badge variant="outline" className="text-xs shrink-0">{teamName}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* wrap to prevent flex-1 inside NewMeetingButton from growing */}
          <div className="w-fit">
            <NewInteractionButton memberId={member.id} memberName={member.name} />
          </div>
          <MemberEditButton member={member} teams={teams ?? []} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="space-y-6">
          {/* Details */}
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Details</h2>
            {member.role_description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{member.role_description}</p>
            )}
            <div className="space-y-2.5 text-sm">
              {member.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}
              {member.start_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>Joined {format(new Date(member.start_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                <span>{interactions.length} {interactions.length === 1 ? 'interaction' : 'interactions'} total</span>
              </div>
              {daysSince !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Last 1-on-1
                  </span>
                  <Badge
                    variant={daysSince > 14 ? 'destructive' : 'outline'}
                    className="text-xs"
                  >
                    {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
                  </Badge>
                </div>
              )}
            </div>
            {member.skills && member.skills.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {member.skills.map((skill: string) => (
                    <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Insights */}
          <SentimentInsightsCard
            avgSentiment={avgSentiment}
            sentimentHistory={sentimentHistory}
            themes={themes}
            nudges={nudges}
            meetingCount={withScore.length}
          />

          {/* Future integrations placeholder */}
          <div className="rounded-lg border border-dashed p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">Integrations</h2>
              <Badge variant="outline" className="text-xs ml-auto">Coming soon</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Pull external signals to build a fuller picture of each team member.
            </p>
            <div className="space-y-2">
              {[
                'GitHub — commits & pull requests',
                'Jira / Linear — tickets completed',
                'Slack — engagement patterns',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground/60">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Interaction history */}
          <div className="rounded-lg border bg-card">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Interaction history</h2>
              <span className="text-xs text-muted-foreground">{interactions.length} total</span>
            </div>
            {interactions.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No interactions yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Use "New interaction" above to get started.</p>
              </div>
            ) : (
              <div className="divide-y">
                {interactions.map((interaction) => {
                  const badge = interaction.sentiment_score !== null
                    ? sentimentBadge(interaction.sentiment_score)
                    : null
                  return (
                    <Link
                      key={interaction.id}
                      href={`/interactions/${interaction.id}`}
                      className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="shrink-0 text-right min-w-[44px]">
                        <p className="text-sm font-medium tabular-nums">
                          {format(parseISO(interaction.scheduled_at), 'MMM d')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(interaction.scheduled_at), 'yyyy')}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">
                            {interaction.title ?? 'Untitled interaction'}
                          </p>
                          {badge && (
                            <Badge variant={badge.variant} className="text-xs shrink-0">
                              {badge.label}
                            </Badge>
                          )}
                        </div>
                        {interaction.ai_summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {interaction.ai_summary}
                          </p>
                        )}
                        {interaction.key_themes && interaction.key_themes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {interaction.key_themes.slice(0, 4).map((theme) => (
                              <Badge key={theme} variant="outline" className="text-xs px-1.5 py-0">
                                {theme}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-60 transition-opacity mt-0.5" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action items */}
          <div className="rounded-lg border bg-card">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Action items</h2>
              <span className="text-xs text-muted-foreground">
                {openItems.length + inProgressItems.length} open
                {doneItems.length > 0 ? ` · ${doneItems.length} done` : ''}
              </span>
            </div>
            {items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No action items yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use "Extract items" in an interaction to generate them automatically.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {[...openItems, ...inProgressItems, ...doneItems].map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 px-5 py-3.5 ${item.status === 'done' ? 'opacity-50' : ''}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.status === 'done' ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : item.status === 'in_progress' ? (
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <p className={`flex-1 text-sm leading-relaxed ${item.status === 'done' ? 'line-through' : ''}`}>
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.due_date && (
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(item.due_date), 'MMM d')}
                        </span>
                      )}
                      <Badge
                        variant={item.status === 'done' ? 'secondary' : item.status === 'in_progress' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
