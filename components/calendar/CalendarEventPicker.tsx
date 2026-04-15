"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Link2, X, Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { CalendarEvent } from "@/lib/google/calendar";

function eventDurationMinutes(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  );
}

interface Props {
  interactionId: string;
  linkedEventId: string | null;
  linkedEventTitle?: string | null;
  onLinked: (durationMinutes: number, eventId: string, eventTitle: string) => void;
  onUnlinked: () => void;
}

export function CalendarEventPicker({
  interactionId,
  linkedEventId,
  linkedEventTitle,
  onLinked,
  onUnlinked,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEvents = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/calendar/search${params}`);
      const data = await res.json();
      if (data.connected === false) {
        setConnected(false);
        setEvents([]);
      } else {
        setEvents(data.events ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchEvents("");
  }, [open, fetchEvents]);

  useEffect(() => {
    if (!open) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchEvents(query), 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query, open, fetchEvents]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = useCallback(
    async (event: CalendarEvent) => {
      const mins = eventDurationMinutes(event.start, event.end);
      const supabase = createClient();
      const { error } = await supabase
        .from("interactions")
        .update({
          google_calendar_event_id: event.id,
          duration_minutes: mins > 0 ? mins : null,
        })
        .eq("id", interactionId);

      if (error) {
        toast.error("Failed to link event");
        return;
      }

      onLinked(mins, event.id, event.summary);
      setOpen(false);
      setQuery("");
      toast.success("Calendar event linked");
    },
    [interactionId, onLinked],
  );

  const handleUnlink = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("interactions")
      .update({ google_calendar_event_id: null })
      .eq("id", interactionId);

    if (error) {
      toast.error("Failed to unlink event");
      return;
    }

    onUnlinked();
    toast.success("Calendar event unlinked");
  }, [interactionId, onUnlinked]);

  if (linkedEventId) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground max-w-full">
        <CalendarDays className="h-3 w-3 shrink-0 text-primary" />
        <span className="truncate">{linkedEventTitle ?? "Calendar event linked"}</span>
        <button
          onClick={handleUnlink}
          className="shrink-0 hover:text-destructive transition-colors"
          title="Unlink event"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60"
      >
        <Link2 className="h-3 w-3" />
        Link calendar event
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-lg border bg-popover shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
          </div>

          {/* Event list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {!connected ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                Connect Google Calendar from the Personal tab first.
              </p>
            ) : events.length === 0 && !loading ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                No events found
              </p>
            ) : (
              events.map((event) => {
                const isAllDay = event.start.length === 10;
                const startDate = parseISO(event.start);
                const mins = isAllDay ? 0 : eventDurationMinutes(event.start, event.end);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleSelect(event)}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors"
                  >
                    <div className="mt-0.5 shrink-0 w-1 rounded-full bg-primary/60 h-full self-stretch" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{event.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {isAllDay
                          ? format(startDate, "MMM d")
                          : `${format(startDate, "MMM d, h:mm a")}${mins > 0 ? ` · ${mins}m` : ""}`}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
