"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Calendar,
  ListChecks,
  ChevronRight,
  Users,
  CheckCircle,
  X,
  Check,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  due_today_action_items?: { id: string; description: string; member_name: string | null }[];
  action_items_count: number;
  meetings_today: {
    title: string;
    start: string;
    end: string;
    duration_minutes: number;
  }[];
  total_meeting_hours: number;
  suggested_meetings: SuggestedMeeting[];
  team_members?: { id: string; name: string }[];
  yesterday_recap?: {
    interactions: {
      title: string;
      member_name: string | null;
      ai_summary: string | null;
    }[];
  };
  team_member_hours?: {
    member_id: string;
    member_name: string;
    meeting_minutes: number;
  }[];
  date?: string;
}

interface DayState {
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
  const [briefingDate, setBriefingDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  void userId;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const storageKey = `daily-briefing-${todayStr}`;

  const [dayState, setDayState] = useState<DayState>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as DayState;
    } catch {}
    return { overdueChecked: {} };
  });

  function saveDayState(next: DayState) {
    setDayState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
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

  async function generate() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/ai/daily-briefing", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBriefing(data.briefing);
      if (data.date) setBriefingDate(data.date as string);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/daily-briefing");
        const data = await res.json();
        if (data.briefing) {
          setBriefing(data.briefing);
          if (data.date) setBriefingDate(data.date as string);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  if (!briefing) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground flex items-center justify-between mb-4">
        <span>No briefing yet for today.</span>
        <Button size="sm" variant="ghost" onClick={generate}>
          Generate
        </Button>
      </div>
    );
  }

  const teamMembers = briefing.team_members ?? [];

  const hasOverdue = briefing.overdue_reminders.length > 0;
  const hasMeetings = briefing.meetings_today.length > 0;
  const hasSuggestions = briefing.suggested_meetings.length > 0;
  const hasRecap = (briefing.yesterday_recap?.interactions ?? []).length > 0;
  const memberHoursMap = Object.fromEntries(
    (briefing.team_member_hours ?? []).map((h) => [h.member_id, h.meeting_minutes]),
  );
  const teamMemberHoursWithData = (briefing.team_member_hours ?? []).filter(
    (h) => h.meeting_minutes > 0,
  );

  const isStale = briefingDate !== null && briefingDate !== todayStr;
  const displayDate = briefingDate
    ? format(new Date(briefingDate + "T12:00:00"), "EEEE, d MMMM")
    : format(new Date(), "EEEE, d MMMM");

  return (
    <div className="rounded-lg border bg-card mb-4 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div>
          <p className="text-lg font-bold ">Daily briefing</p>
          <p className="text-xs font-medium text-muted-foreground">
            {displayDate}
            {isStale && (
              <span className="ml-1.5 text-amber-600 dark:text-amber-400">· not yet refreshed</span>
            )}
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

        {/* Action items due today — count */}
        {(briefing.due_today_action_items ?? []).length > 0 && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">
              {(briefing.due_today_action_items ?? []).length} action item
              {(briefing.due_today_action_items ?? []).length === 1 ? "" : "s"} due today
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

        {/* Yesterday's recap */}
        {hasRecap && (
          <div className="px-4 py-2.5 space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Yesterday
            </p>
            {(briefing.yesterday_recap?.interactions ?? []).map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">
                    {item.title}
                    {item.member_name && (
                      <span className="font-normal text-muted-foreground">
                        {" "}· {item.member_name}
                      </span>
                    )}
                  </span>
                  {item.ai_summary && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.ai_summary}
                    </p>
                  )}
                </div>
              </div>
            ))}
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

        {/* Today's priorities — quick-add */}
        <TodaysPriorities userId={userId} />

        {/* Suggested meetings */}
        {hasSuggestions && (
          <div className="px-4 py-2.5 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Consider connecting with
            </p>
            {briefing.suggested_meetings.map((m) => {
              const hoursToday = memberHoursMap[m.member_id];
              return (
                <div key={m.member_id} className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{m.member_name}</span>
                    <span className="text-muted-foreground text-xs">
                      {m.last_met_days_ago !== null
                        ? ` · ${m.last_met_days_ago}d ago`
                        : " · never met"}
                      {hoursToday != null && hoursToday > 0 && (
                        <> · {Math.round((hoursToday / 60) * 10) / 10}h in meetings</>
                      )}
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
              );
            })}
          </div>
        )}

        {/* Team meeting load today */}
        {teamMemberHoursWithData.length > 0 && (
          <div className="px-4 py-2.5 space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Team meeting load today
            </p>
            {teamMemberHoursWithData.map((h) => (
              <div key={h.member_id} className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 font-medium">{h.member_name}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round((h.meeting_minutes / 60) * 10) / 10}h
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs gap-1 shrink-0 text-muted-foreground"
                  onClick={() => router.push(`/team/${h.member_id}`)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type SearchResult = { id: string; title: string | null; description: string; memberName: string | null };
type PriorityItem = { id: string; title: string | null; description: string };

function itemLabel(item: { title: string | null; description: string }) {
  return item.title || item.description;
}

function TodaysPriorities({ userId }: { userId: string }) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load today's priorities (RLS handles access)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("action_items")
      .select("id, title, description")
      .eq("due_date", todayStr)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: true })
      .then(({ data }) => setItems(data ?? []));
  }, [userId, todayStr]);

  // Search existing todos as user types (title + description)
  useEffect(() => {
    if (draft.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const todayIds = new Set(items.map((i) => i.id));
      const q = draft.replace(/[%_]/g, "\\$&");
      const { data } = await supabase
        .from("action_items")
        .select("id, title, description, interactions!left(team_members(name))")
        .or(`description.ilike.%${q}%,title.ilike.%${q}%`)
        .in("status", ["open", "in_progress"])
        .limit(8);
      setResults(
        (data ?? [])
          .filter((r) => !todayIds.has(r.id))
          .map((r) => ({
            id: r.id,
            title: r.title ?? null,
            description: r.description,
            memberName: (r.interactions as any)?.team_members?.name ?? null,
          }))
          .slice(0, 5),
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [draft, items]);

  async function pullIn(result: SearchResult) {
    setResults([]);
    setDraft("");
    const supabase = createClient();
    await supabase.from("action_items").update({ due_date: todayStr }).eq("id", result.id);
    setItems((prev) => [...prev, { id: result.id, title: result.title, description: result.description }]);
    inputRef.current?.focus();
  }

  async function add() {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    setResults([]);
    const supabase = createClient();
    const { data } = await supabase
      .from("action_items")
      .insert({ user_id: userId, description: text, status: "open", due_date: todayStr })
      .select("id, title, description")
      .single();
    if (data) setItems((prev) => [...prev, data]);
    setDraft("");
    setSaving(false);
    inputRef.current?.focus();
  }

  async function complete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/action-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/action-items/${id}`, { method: "DELETE" });
  }

  return (
    <div className="px-4 py-2.5 space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        Today&apos;s priorities
      </p>
      {items.map((item) => (
        <div key={item.id} className="group flex items-center gap-2">
          <button
            onClick={() => complete(item.id)}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-muted-foreground hover:border-green-500 hover:bg-green-500 hover:text-white transition-colors"
            title="Mark done"
          >
            <Check className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
          </button>
          <span className="flex-1">{itemLabel(item)}</span>
          <button
            onClick={() => remove(item.id)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Delete"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <div className="relative">
        <div className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") { setResults([]); setDraft(""); }
            }}
            onBlur={() => setTimeout(() => setResults([]), 150)}
            placeholder="Add or search todos..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 min-w-0"
            disabled={saving}
          />
          {draft.trim() && (
            <button
              onClick={add}
              disabled={saving}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Add new
            </button>
          )}
        </div>
        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-md py-1">
            {results.map((r) => (
              <button
                key={r.id}
                onMouseDown={(e) => { e.preventDefault(); pullIn(r); }}
                className="w-full flex items-start gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate">{r.title || r.description}</div>
                  {r.title && r.description && (
                    <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                  )}
                </div>
                {r.memberName && (
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{r.memberName}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
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
