'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SentimentSparkline } from './SentimentSparkline'
import { NewInteractionButton } from './NewMeetingButton'
import type { TeamMember } from '@/lib/supabase/types'

interface Props {
  member: TeamMember
  lastInteractionId: string | null
  daysSince: number | null
  sentimentHistory: number[]
}

export function TeamMemberCard({ member, lastInteractionId, daysSince, sentimentHistory }: Props) {
  const overdue = daysSince === null || daysSince > 14

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{member.name}</h3>
            {member.level && (
              <p className="text-xs text-muted-foreground capitalize">{member.level}</p>
            )}
          </div>
          {member.level && (
            <Badge variant="secondary" className="shrink-0 capitalize text-xs">
              {member.level}
            </Badge>
          )}
        </div>
        {member.role_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{member.role_description}</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {/* Days since last 1-on-1 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Last 1-on-1</span>
          <Badge variant={overdue ? 'destructive' : 'outline'} className="text-xs">
            {daysSince === null ? 'Never' : daysSince === 0 ? 'Today' : `${daysSince}d ago`}
          </Badge>
        </div>

        {/* Sentiment sparkline */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Sentiment trend</p>
          <SentimentSparkline data={sentimentHistory} />
        </div>

        {/* Skills */}
        {member.skills && member.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {member.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs px-1.5 py-0">
                {skill}
              </Badge>
            ))}
            {member.skills.length > 4 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                +{member.skills.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {lastInteractionId && (
            <Link
              href={`/interactions/${lastInteractionId}`}
              className="flex-1 text-xs inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted transition-colors"
            >
              Last notes
            </Link>
          )}
          <NewInteractionButton memberId={member.id} memberName={member.name} />
        </div>
      </CardContent>
    </Card>
  )
}
