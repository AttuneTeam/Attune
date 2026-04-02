'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { CalendarPlus, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { addHours } from 'date-fns'

type UpcomingBooking = {
  id: string
  title: string | null
  scheduled_at: string
  agenda: string | null
  team_members: { name: string } | null
}

function buildGCalUrl(title: string, scheduledAt: string, agenda: string) {
  const start = parseISO(scheduledAt)
  const end = addHours(start, 1)
  const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss'Z'")
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: agenda,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function UpcomingList({ bookings }: { bookings: UpcomingBooking[] }) {
  const router = useRouter()

  const startMeeting = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('interactions')
      .update({ status: 'completed' })
      .eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      router.push(`/interactions/${id}`)
    }
  }

  return (
    <div className="rounded-lg border divide-y mb-8">
      {bookings.map((booking) => (
        <div key={booking.id} className="flex items-center gap-4 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {booking.title || 'Untitled booking'}
            </p>
            <p className="text-xs text-muted-foreground">
              {booking.team_members?.name ?? '—'} &middot;{' '}
              {format(parseISO(booking.scheduled_at), 'MMM d, yyyy · h:mm a')}
            </p>
            {booking.agenda && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{booking.agenda}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={buildGCalUrl(
                booking.title || '1-on-1',
                booking.scheduled_at,
                booking.agenda ?? '',
              )}
              target="_blank"
              rel="noopener noreferrer"
              title="Add to Google Calendar"
              className="text-muted-foreground hover:text-foreground"
            >
              <CalendarPlus className="h-4 w-4" />
            </a>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => startMeeting(booking.id)}
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
