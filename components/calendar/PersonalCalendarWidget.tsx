"use client";

import { useEffect, useState } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { CalendarDays, Clock, ExternalLink } from "lucide-react";
import { GoogleCalendarConnect } from "./GoogleCalendarConnect";
import type { CalendarEvent } from "@/lib/google/calendar";

function formatEventTime(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  // All-day events have dates without times
  if (start.length === 10) return "All day";
  const mins = Math.round((e.getTime() - s.getTime()) / 60000);
  const duration =
    mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
  return `${format(s, "h:mm a")} · ${duration}`;
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = event.start.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(event);
  }
  return Array.from(map.entries());
}

export function PersonalCalendarWidget({ connected }: { connected: boolean }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(connected);
  const [isConnected, setIsConnected] = useState(connected);

  useEffect(() => {
    if (!connected) return;
    fetch("/api/calendar/events")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected === false) {
          setIsConnected(false);
        } else {
          setEvents(data.events ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [connected]);

  if (!isConnected) {
    return (
      <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Upcoming Events</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Connect your Google Calendar to see upcoming events here.
        </p>
        <GoogleCalendarConnect connected={false} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Upcoming Events</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const grouped = groupByDay(events);

  return (
    <div className="rounded-lg border bg-card px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Upcoming Events</span>
        </div>
        <GoogleCalendarConnect connected={true} />
      </div>

      {grouped.length === 0 ? (
        <p className="text-xs text-muted-foreground">No upcoming events in the next 14 days.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                {dayLabel(day)}
              </p>
              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-1 rounded-full bg-primary/60 self-stretch mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.summary}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatEventTime(event.start, event.end)}
                      </p>
                    </div>
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground"
                        title="Open in Google Calendar"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
