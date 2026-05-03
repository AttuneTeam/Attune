"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Calendar,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Users,
  ListChecks,
  CheckCircle,
  X,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface PriorityItem {
  type: "reminder" | "action_item";
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
  due_today_reminders: {
    id: string;
    content: string;
    due_date: string | null;
  }[];
  action_items_count: number;
  meetings_today: {
    title: string;
    start: string;
    end: string;
    duration_minutes: number;
  }[];
  total_meeting_hours: number;
  priority_items: PriorityItem[];
  suggested_meetings: SuggestedMeeting[];
  team_members?: { id: string; name: string }[];
}

interface DayState {
  accepted: Record<string, boolean>;
  rejected: string[];
  overdueChecked: Record<string, boolean>;
}

function linkifyNames(
  text: string,
  teamMembers: { id: string; name: string }[],
): React.ReactNode {
  if (!teamMembers.length) return text;
  const sorted = [...teamMembers].sort((a, b) => b.name.length - a.name.length);
  const pattern = sorted
    .map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");
  const nameMap = Object.fromEntries(
    teamMembers.map((m) => [m.name.toLowerCase(), m.id]),
  );
  const parts = text.split(regex);
  return parts.map((part, i) => {
    const id = nameMap[part.toLowerCase()];
    if (id) {
      return (
        <Link
          key={i}
          href={`/team/${id}`}
          className="font-medium underline underline-offset-2 hover:text-foreground"
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}

export function DailyBriefing({ userId }: { userId: string }) {
  const router = useRouter();
  const [briefing, setBriefing] = useState<BriefingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // userId is used to key the effect; not sent to the API (auth handles identity)
  void userId;

  const today = format(new Date(), "yyyy-MM-dd");
  const storageKey = `daily-briefing-${today}`;

  const [dayState, setDayState] = useState<DayState>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as DayState;
    } catch {}
    return { accepted: {}, rejected: [], overdueChecked: {} };
  });

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  function saveDayState(next: DayState) {
    setDayState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  function toggleExpand(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function acceptItem(id: string) {
    saveDayState({
      ...dayState,
      accepted: { ...dayState.accepted, [id]: false },
    });
  }

  async function toggleAccepted(id: string, type: PriorityItem["type"]) {
    const newChecked = !dayState.accepted[id];
    const snapshot = dayState;
    saveDayState({
      ...dayState,
      accepted: { ...dayState.accepted, [id]: newChecked },
    });

    const newStatus = newChecked ? "done" : "open";
    try {
      if (type === "action_item") {
        await fetch(`/api/action-items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      } else {
        const supabase = createClient();
        await supabase
          .from("personal_items")
          .update({ status: newStatus })
          .eq("id", id);
      }
      router.refresh();
    } catch {
      saveDayState(snapshot);
    }
  }

  function rejectItem(id: string) {
    saveDayState({ ...dayState, rejected: [...dayState.rejected, id] });
  }

  async function toggleOverdueItem(id: string) {
    const newChecked = !dayState.overdueChecked[id];
    const snapshot = dayState;
    saveDayState({
      ...dayState,
      overdueChecked: { ...dayState.overdueChecked, [id]: newChecked },
    });

    const newStatus = newChecked ? "done" : "open";
    try {
      const supabase = createClient();
      await supabase
        .from("personal_items")
        .update({ status: newStatus })
        .eq("id", id);
      router.refresh();
    } catch {
      saveDayState(snapshot);
    }
  }

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

  const overdueIds = new Set(briefing.overdue_reminders.map((r) => r.id));
  const teamMembers = briefing.team_members ?? [];

  const visiblePriorityItems = briefing.priority_items.filter(
    (item) => !overdueIds.has(item.id) && !dayState.rejected.includes(item.id),
  );
  const acceptedItems = visiblePriorityItems.filter(
    (item) => item.id in dayState.accepted,
  );
  const pendingItems = visiblePriorityItems.filter(
    (item) => !(item.id in dayState.accepted),
  );

  const hasOverdue = briefing.overdue_reminders.length > 0;
  const hasMeetings = briefing.meetings_today.length > 0;
  const hasPriorities = visiblePriorityItems.length > 0;
  const hasSuggestions = briefing.suggested_meetings.length > 0;

  if (!hasOverdue && !hasMeetings && !hasPriorities && !hasSuggestions)
    return null;

  return (
    <div className="rounded-lg border bg-card mb-4 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div>
          <p className="text-lg font-bold ">Daily briefing</p>
          <p className="text-xs font-medium text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM")}
          </p>
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
                  {" "}
                  · {briefing.total_meeting_hours}h
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
              <span className="font-medium">
                {briefing.action_items_count} open action item
                {briefing.action_items_count === 1 ? "" : "s"}
              </span>
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
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Overdue
            </p>
            {briefing.overdue_reminders.map((r) => {
              const checked = !!dayState.overdueChecked?.[r.id];
              return (
                <div key={r.id} className="flex items-start gap-2">
                  <button
                    onClick={() => toggleOverdueItem(r.id)}
                    className={`flex h-4 w-4 mt-0.5 shrink-0 items-center justify-center rounded border transition-colors ${
                      checked
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-red-400 hover:border-red-600"
                    }`}
                  >
                    {checked && <Check className="h-2.5 w-2.5" />}
                  </button>
                  <span
                    className={`flex-1 ${
                      checked
                        ? "line-through text-muted-foreground"
                        : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {r.content}
                  </span>
                  {!checked && (
                    <Badge
                      variant="destructive"
                      className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                    >
                      overdue
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Priority items */}
        {hasPriorities && (
          <div className="px-4 py-2.5 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Today&apos;s priorities
            </p>

            {/* Accepted items — checkbox mode */}
            {acceptedItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-start gap-2"
              >
                <button
                  onClick={() => toggleAccepted(item.id, item.type)}
                  className={`flex h-4 w-4 mt-0.5 shrink-0 items-center justify-center rounded border transition-colors ${
                    dayState.accepted[item.id]
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-muted-foreground hover:border-foreground"
                  }`}
                >
                  {dayState.accepted[item.id] && (
                    <Check className="h-2.5 w-2.5" />
                  )}
                </button>
                <span
                  className={`flex-1 font-medium ${
                    dayState.accepted[item.id]
                      ? "line-through text-muted-foreground"
                      : ""
                  }`}
                >
                  {linkifyNames(item.description, teamMembers)}
                </span>
                <TypeBadge type={item.type} />
              </div>
            ))}

            {/* Pending items — numbered, expandable, hover accept/reject */}
            {pendingItems.map((item, i) => {
              const isExpanded = expandedItems.has(item.id);
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="group flex items-start gap-2"
                >
                  <span className="text-xs text-muted-foreground w-4 shrink-0 mt-0.5 tabular-nums">
                    {i + 1}
                  </span>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => toggleExpand(item.id)}
                  >
                    <div className="flex items-start gap-1">
                      <span className="font-medium flex-1">
                        {linkifyNames(item.description, teamMembers)}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                    {isExpanded && item.urgency_reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {linkifyNames(item.urgency_reason, teamMembers)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 relative">
                    <div className="group-hover:hidden">
                      <TypeBadge type={item.type} />
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={() => acceptItem(item.id)}
                        className="p-0.5 rounded text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                        title="Accept"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rejectItem(item.id);
                        }}
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
                    <p className="text-xs text-muted-foreground">{m.reason}</p>
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

function TypeBadge({ type }: { type: "reminder" | "action_item" }) {
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
