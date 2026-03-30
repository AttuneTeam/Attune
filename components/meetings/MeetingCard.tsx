import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'

interface MeetingWithMember {
  id: string
  scheduled_at: string
  ai_summary: string | null
  sentiment_score: number | null
  key_themes: string[]
  title: string | null
  team_members: { id: string; name: string; level: string | null } | null
}

function sentimentLabel(score: number | null) {
  if (score === null) return null
  if (score >= 0.3) return { label: 'Positive', variant: 'default' as const, color: 'text-green-600' }
  if (score >= -0.3) return { label: 'Neutral', variant: 'secondary' as const, color: 'text-amber-600' }
  return { label: 'Negative', variant: 'destructive' as const, color: 'text-red-600' }
}

export function MeetingCard({ meeting }: { meeting: MeetingWithMember }) {
  const sentiment = sentimentLabel(meeting.sentiment_score)
  const member = meeting.team_members

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="flex items-start gap-4 rounded-lg border bg-card p-4 hover:bg-accent/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{member?.name ?? 'Unknown'}</span>
          {member?.level && (
            <Badge variant="outline" className="text-xs capitalize">{member.level}</Badge>
          )}
          {sentiment && (
            <Badge variant={sentiment.variant} className="text-xs ml-auto">
              {sentiment.label}
            </Badge>
          )}
        </div>
        {meeting.title ? (
          <p className="text-sm font-medium mb-0.5">{meeting.title}</p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic mb-0.5">Untitled meeting</p>
        )}
        <p className="text-xs text-muted-foreground mb-2">
          {format(new Date(meeting.scheduled_at), 'MMMM d, yyyy')}
        </p>
        {meeting.ai_summary ? (
          <p className="text-sm text-muted-foreground line-clamp-2">{meeting.ai_summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary yet</p>
        )}
        {meeting.key_themes && meeting.key_themes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {meeting.key_themes.map((theme) => (
              <Badge key={theme} variant="outline" className="text-xs">{theme}</Badge>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
    </Link>
  )
}
