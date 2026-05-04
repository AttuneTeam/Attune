"use client";

import { useState } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  Link2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    mins < 60
      ? `${mins}m`
      : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
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

export function CalendarSheet({
  connected,
  members = [],
}: {
  connected: boolean;
  members?: TeamMember[];
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [syncedEventIds, setSyncedEventIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(connected);

  const memberEmailMap = new Map<string, TeamMember>();
  for (const m of members) {
    if (m.email) memberEmailMap.set(m.email.toLowerCase(), m);
  }

  function findMatchedMember(event: CalendarEvent): TeamMember | null {
    const matches = (event.attendees ?? [])
      .map((a) => memberEmailMap.get(a.email.toLowerCase()))
      .filter((m): m is TeamMember => m !== undefined);
    return matches.length === 1 ? matches[0] : null;
  }

  async function loadEvents() {
    if (events !== null) return;
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/events");
      const data = await res.json();
      if (data.connected === false) {
        setIsConnected(false);
      } else {
        setEvents(data.events ?? []);
        setSyncedEventIds(data.syncedEventIds ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
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

  const grouped = events ? groupByDay(events) : [];
  const todayCount =
    grouped.find(([day]) => isToday(parseISO(day)))?.[1].length ?? 0;

  return (
    <>
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="flex gap-1 text-xs text-muted-foreground uppercase tracking-wide">
                <CalendarDays className="h-3 w-3" />
                Upcoming Events
              </p>
              {isConnected && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>(Google)</span>
                </div>
              )}
            </div>

            {isConnected ? (
              <>
                <p className="text-3xl font-bold mb-2">
                  {events === null ? "—" : todayCount}
                </p>
                <p className="text-xs text-muted-foreground">Next Meeting</p>
                {events?.[0].summary}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not connected</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => {
              setOpen(true);
              if (isConnected) loadEvents();
            }}
          >
            {isConnected ? (
              <>
                View <ArrowRight className="h-3 w-3" />
              </>
            ) : (
              <>
                Connect <ArrowRight className="h-3 w-3" />
              </>
            )}
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto p-0 gap-0">
          <SheetHeader className="border-b px-6 py-4 sticky top-0 bg-popover">
            <div className="flex items-center justify-between">
              <SheetTitle>Upcoming Events</SheetTitle>
              <GoogleCalendarConnect connected={isConnected} />
            </div>
          </SheetHeader>
          <div className="p-6">
            {!isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect your Google Calendar to see upcoming events here.
                </p>
                <GoogleCalendarConnect connected={false} />
              </div>
            ) : loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming events in the next 14 days.
              </p>
            ) : (
              <div className="space-y-5">
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
                              <p className="text-sm font-medium truncate">
                                {event.summary}
                              </p>
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
                                  onClick={() =>
                                    handleSync(event, matchedMember)
                                  }
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
        </SheetContent>
      </Sheet>
    </>
  );
}
