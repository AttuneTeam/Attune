import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import type { StrategicInitiative } from '@/lib/supabase/types'

const STATUS_COLORS: Record<string, string> = {
  active: 'default',
  paused: 'secondary',
  completed: 'outline',
  archived: 'secondary',
}

export function InitiativeCard({ initiative }: { initiative: StrategicInitiative }) {
  const visibleTags = initiative.tags.slice(0, 3)
  const extraTags = initiative.tags.length - visibleTags.length

  return (
    <Link
      href={`/initiatives/${initiative.id}`}
      className="block rounded-lg border bg-card px-5 py-4 hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{initiative.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(initiative.updated_at), 'MMM d, yyyy')}
            {initiative.domain && (
              <span className="ml-2 text-muted-foreground/70">· {initiative.domain}</span>
            )}
            {initiative.horizon && (
              <span className="ml-2 text-muted-foreground/70">· {initiative.horizon}</span>
            )}
          </p>
        </div>
        <Badge
          variant={STATUS_COLORS[initiative.status] as 'default' | 'secondary' | 'outline' | 'destructive'}
          className="shrink-0"
        >
          {initiative.status}
        </Badge>
      </div>
      {initiative.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-[11px] font-medium"
            >
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px]">
              +{extraTags} more
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
