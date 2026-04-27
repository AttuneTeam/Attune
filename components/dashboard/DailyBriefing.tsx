"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Calendar, AlertCircle, ChevronRight, Users, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";

interface PriorityItem {
  type: "todo" | "reminder" | "action_item";
  id: string;
  description: string;
  urgency_reason: string;
}

interface SuggestedMeeting {
  member_id: string;
  member_name: string;
  reason: string;
  last_met_days_ago: number | null;
}

interface BriefingContent {
  overdue_reminders: { id: string; content: string; due_date: string | null }[];
  due_today_reminders: { id: string; content: string; due_date: string | null }[];
  action_items_count: number;
  meetings_today: { title: string; start: string; end: string; duration_minutes: number }[];
  total_meeting_hours: number;
  priority_items: PriorityItem[];
  suggested_meetings: SuggestedMeeting[];
}

export function DailyBriefing({ userId }: { userId: string }) {
  const router = useRouter();
  const [briefing, setBriefing] = useState<BriefingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // userId is used to key the effect; not sent to the API (auth handles identity)
  void userId;

  const generate = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/ai/daily-briefing", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBriefing(data.briefing);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/daily-briefing");
        const data = await res.json();
        if (data.briefing) {
          setBriefing(data.briefing);
          setLoading(false);
          return;
        }
      } catch {
        // fall through to generate
      }
      generate();
    })();
  }, [generate]);

  if (loading) return <BriefingSkeleton />;

  if (error) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground flex items-center justify-between mb-4">
        <span>Couldn&apos;t generate your daily briefing.</span>
        <Button size="sm" variant="ghost" onClick={generate}>
          Retry
        </Button>
      </div>
    );
  }

  if (!briefing) return null;

  const hasOverdue = briefing.overdue_reminders.length > 0;
  const hasMeetings = briefing.meetings_today.length > 0;
  const hasPriorities = briefing.priority_items.length > 0;
  const hasSuggestions = briefing.suggested_meetings.length > 0;

  if (!hasOverdue && !hasMeetings && !hasPriorities && !hasSuggestions) return null;

  return (
    <div className="rounded-lg border bg-card mb-4 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div>
          <p className="text-xs font-medium">{format(new Date(), "EEEE, d MMMM")}</p>
          <p className="text-[11px] text-muted-foreground">Daily briefing</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1.5 text-xs text-muted-foreground"
          onClick={generate}
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      <div className="divide-y">
        {/* Meeting load */}
        {hasMeetings && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>
              <span className="font-medium">
                {briefing.meetings_today.length} meeting
                {briefing.meetings_today.length === 1 ? "" : "s"} today
              </span>
              {briefing.total_meeting_hours > 0 && (
                <span className="text-muted-foreground">
                  {" "}· {briefing.total_meeting_hours}h
                </span>
              )}
            </span>
          </div>
        )}

        {/* Action items count */}
        {briefing.action_items_count > 0 && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>
              <span className="font-medium">{briefing.action_items_count} open action item{briefing.action_items_count === 1 ? "" : "s"}</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1 ml-auto shrink-0 text-muted-foreground"
              onClick={() => router.push("/action-items")}
            >
              View <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Overdue reminders */}
        {hasOverdue && (
          <div className="px-4 py-2.5 space-y-1.5">
            {briefing.overdue_reminders.map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                <span className="flex-1 text-red-700 dark:text-red-400">{r.content}</span>
                <Badge
                  variant="destructive"
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  overdue
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Priority items */}
        {hasPriorities && (
          <div className="px-4 py-2.5 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Today&apos;s priorities
            </p>
            {briefing.priority_items.map((item, i) => (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-4 shrink-0 mt-0.5 tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{item.description}</span>
                  {item.urgency_reason && (
                    <span className="text-muted-foreground text-xs">
                      {" — "}
                      {item.urgency_reason}
                    </span>
                  )}
                </div>
                <TypeBadge type={item.type} />
              </div>
            ))}
          </div>
        )}

        {/* Suggested meetings */}
        {hasSuggestions && (
          <div className="px-4 py-2.5 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Consider connecting with
            </p>
            {briefing.suggested_meetings.map((m) => (
              <div key={m.member_id} className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{m.member_name}</span>
                  <span className="text-muted-foreground text-xs">
                    {m.last_met_days_ago !== null
                      ? ` · ${m.last_met_days_ago}d ago`
                      : " · never met"}
                  </span>
                  {m.reason && (
                    <p className="text-xs text-muted-foreground truncate">{m.reason}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs gap-1 shrink-0 text-muted-foreground"
                  onClick={() => router.push(`/team/${m.member_id}`)}
                >
                  View <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: "todo" | "reminder" | "action_item" }) {
  if (type === "todo") {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
        todo
      </Badge>
    );
  }
  if (type === "reminder") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0 h-4 text-[10px] font-medium shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        reminder
      </span>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
      action
    </Badge>
  );
}

function BriefingSkeleton() {
  return (
    <div className="rounded-lg border bg-card mb-4 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="space-y-1.5">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-2.5 w-20 rounded bg-muted" />
        </div>
        <div className="h-7 w-16 rounded bg-muted" />
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="h-4 w-44 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-4/5 rounded bg-muted" />
        <div className="h-4 w-3/5 rounded bg-muted" />
      </div>
    </div>
  );
}
