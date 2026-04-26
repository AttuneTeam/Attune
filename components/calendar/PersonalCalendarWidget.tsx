"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { CalendarDays, Clock, ExternalLink, Link2, RefreshCw } from "lucide-react";
import { GoogleCalendarConnect } from "./GoogleCalendarConnect";
import { createClient } from "@/lib/supabase/client";
import { eventDurationMinutes } from "@/lib/google/calendar";
import { toast } from "sonner";
import type { CalendarEvent } from "@/lib/google/calendar";
import type { TeamMember } from "@/lib/supabase/types";

function formatEventTime(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
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

export function PersonalCalendarWidget({
  connected,
  members = [],
}: {
  connected: boolean;
  members?: TeamMember[];
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [syncedEventIds, setSyncedEventIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
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
          setSyncedEventIds(data.syncedEventIds ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [connected]);

  const memberEmailMap = useMemo(() => {
    const map = new Map<string, TeamMember>();
    for (const m of members) {
      if (m.email) map.set(m.email.toLowerCase(), m);
    }
    return map;
  }, [members]);

  function findMatchedMember(event: CalendarEvent): TeamMember | null {
    const matches = (event.attendees ?? [])
      .map((a) => memberEmailMap.get(a.email.toLowerCase()))
      .filter((m): m is TeamMember => m !== undefined);
    return matches.length === 1 ? matches[0] : null;
  }

  async function handleSync(event: CalendarEvent, member: TeamMember) {
    setSyncing(event.id);
    setSyncedEventIds((prev) => [...prev, event.id]);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSyncedEventIds((prev) => prev.filter((id) => id !== event.id));
      setSyncing(null);
      return;
    }
    const durationMins = eventDurationMinutes(event.start, event.end);
    const { error } = await supabase.from("interactions").insert({
      participant_id: member.id,
      manager_id: user.id,
      scheduled_at: event.start,
      title: event.summary,
      duration_minutes: durationMins > 0 ? durationMins : null,
      agenda: event.description ?? null,
      type: "scheduled",
      status: "upcoming",
      google_calendar_event_id: event.id,
    });
    if (error) {
      setSyncedEventIds((prev) => prev.filter((id) => id !== event.id));
      toast.error("Failed to sync event");
    } else {
      toast.success(`Synced with ${member.name}`);
    }
    setSyncing(null);
  }

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
                {dayEvents.map((event) => {
                  const matchedMember = findMatchedMember(event);
                  const isSynced = syncedEventIds.includes(event.id);
                  const isSyncing = syncing === event.id;
                  return (
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
                      <div className="flex items-center gap-1 shrink-0">
                        {isSynced ? (
                          <span
                            className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40"
                            title="Synced in Attune"
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            Synced
                          </span>
                        ) : matchedMember ? (
                          <button
                            onClick={() => handleSync(event, matchedMember)}
                            disabled={isSyncing}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
                            title={`Sync with ${matchedMember.name}`}
                          >
                            {isSyncing ? (
                              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Link2 className="h-2.5 w-2.5" />
                            )}
                            Sync
                          </button>
                        ) : null}
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground"
                            title="Open in Google Calendar"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
