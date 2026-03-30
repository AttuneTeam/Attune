import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ChevronRight, Calendar, MessageCircle, FileText, Hash } from 'lucide-react'

interface InteractionWithMember {
  id: string
  scheduled_at: string
  ai_summary: string | null
  sentiment_score: number | null
  key_themes: string[]
  title: string | null
  type: string
  team_members: { id: string; name: string; level: string | null } | null
}

function sentimentLabel(score: number | null) {
  if (score === null) return null
  if (score >= 0.3) return { label: 'Positive', variant: 'default' as const }
  if (score >= -0.3) return { label: 'Neutral', variant: 'secondary' as const }
  return { label: 'Negative', variant: 'destructive' as const }
}

const TYPE_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  scheduled: { label: 'Scheduled', Icon: Calendar },
  incidental: { label: 'Incidental', Icon: MessageCircle },
  note: { label: 'Note', Icon: FileText },
  slack: { label: 'Slack', Icon: Hash },
}

export function InteractionCard({ interaction }: { interaction: InteractionWithMember }) {
  const sentiment = sentimentLabel(interaction.sentiment_score)
  const member = interaction.team_members
  const typeMeta = TYPE_META[interaction.type] ?? TYPE_META.scheduled
  const TypeIcon = typeMeta.Icon

  return (
    <Link
      href={`/interactions/${interaction.id}`}
      className="flex items-start gap-4 rounded-lg border bg-card p-4 hover:bg-accent/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{member?.name ?? 'Unknown'}</span>
          {member?.level && (
            <Badge variant="outline" className="text-xs capitalize">{member.level}</Badge>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
            <TypeIcon className="h-3 w-3" />
            <span>{typeMeta.label}</span>
          </div>
          {sentiment && (
            <Badge variant={sentiment.variant} className="text-xs ml-auto">
              {sentiment.label}
            </Badge>
          )}
        </div>
        {interaction.title ? (
          <p className="text-sm font-medium mb-0.5">{interaction.title}</p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic mb-0.5">Untitled interaction</p>
        )}
        <p className="text-xs text-muted-foreground mb-2">
          {format(new Date(interaction.scheduled_at), 'MMMM d, yyyy')}
        </p>
        {interaction.ai_summary ? (
          <p className="text-sm text-muted-foreground line-clamp-2">{interaction.ai_summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary yet</p>
        )}
        {interaction.key_themes && interaction.key_themes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {interaction.key_themes.map((theme) => (
              <Badge key={theme} variant="outline" className="text-xs">{theme}</Badge>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
    </Link>
  )
}
