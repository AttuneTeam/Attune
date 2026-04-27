import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getValidToken,
  fetchUpcomingEvents,
  eventDurationMinutes,
} from "@/lib/google/calendar";

const BriefingSchema = z.object({
  priority_items: z
    .array(
      z.object({
        type: z.enum(["todo", "reminder", "action_item"]),
        id: z.string().describe("The exact ID from the input data"),
        description: z.string().describe("Concise description of the item"),
        urgency_reason: z
          .string()
          .describe("One-line reason this is urgent today"),
      }),
    )
    .describe("Items ordered by urgency, most urgent first"),
  suggested_meetings: z
    .array(
      z.object({
        member_id: z.string(),
        member_name: z.string(),
        reason: z.string().describe("Brief reason to connect today"),
        last_met_days_ago: z.number().nullable(),
      }),
    )
    .max(3)
    .describe("Team members the manager should consider connecting with"),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("daily_briefings")
    .select("content")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  return NextResponse.json({ briefing: data?.content ?? null });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [
    { data: todos },
    { data: reminders },
    { data: actionItems },
    { data: recentInteractions },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("personal_items")
      .select("id, content, due_date")
      .eq("user_id", user.id)
      .eq("type", "todo")
      .eq("status", "open"),
    supabase
      .from("personal_items")
      .select("id, content, due_date")
      .eq("user_id", user.id)
      .eq("type", "reminder")
      .eq("status", "open")
      .lte("due_date", todayEnd.toISOString()),
    supabase
      .from("action_items")
      .select(
        "id, description, status, due_date, interactions!inner(participant_id, team_members(id, name))",
      )
      .in("status", ["open", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("interactions")
      .select("participant_id, scheduled_at")
      .eq("manager_id", user.id)
      .lt("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(200),
    supabase
      .from("team_members")
      .select("id, name")
      .eq("manager_id", user.id)
      .order("name"),
  ]);

  // Calendar events for today
  let meetingsToday: {
    title: string;
    start: string;
    end: string;
    duration_minutes: number;
  }[] = [];
  let totalMeetingHours = 0;
  try {
    const token = await getValidToken(supabase, user.id);
    const events = await fetchUpcomingEvents(token, 2);
    meetingsToday = events
      .filter((e) => {
        const start = new Date(e.start);
        return start >= todayStart && start <= todayEnd;
      })
      .map((e) => ({
        title: e.summary,
        start: e.start,
        end: e.end,
        duration_minutes: eventDurationMinutes(e.start, e.end),
      }));
    const totalMinutes = meetingsToday.reduce(
      (sum, e) => sum + e.duration_minutes,
      0,
    );
    totalMeetingHours = Math.round((totalMinutes / 60) * 10) / 10;
  } catch {
    // Calendar not connected — skip silently
  }

  // Categorise reminders
  const overdueReminders = (reminders ?? []).filter(
    (r) => r.due_date && new Date(r.due_date) < now,
  );
  const dueTodayReminders = (reminders ?? []).filter(
    (r) => r.due_date && new Date(r.due_date) >= now,
  );

  // Last interaction per member
  const lastMetByMember: Record<string, string> = {};
  for (const i of recentInteractions ?? []) {
    if (!lastMetByMember[i.participant_id]) {
      lastMetByMember[i.participant_id] = i.scheduled_at;
    }
  }

  const memberContext = (members ?? []).map((m) => {
    const lastMet = lastMetByMember[m.id];
    const daysAgo = lastMet
      ? Math.floor(
          (now.getTime() - new Date(lastMet).getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;
    return { id: m.id, name: m.name, daysAgo };
  });

  // Flatten action items with member names
  const actionItemsFlat = (actionItems ?? []).map((a) => {
    const interaction = a.interactions as unknown as Record<string, unknown> | null;
    const member = interaction?.team_members as
      | { id: string; name: string }
      | null;
    return {
      id: a.id,
      description: a.description,
      status: a.status,
      due_date: a.due_date,
      member_name: member?.name ?? null,
    };
  });

  // Build prompt
  // Split todos: those without a due date are plain todos; those with one are treated as reminders
  const todosPlain = (todos ?? []).filter((t) => !t.due_date);
  const todosDated = (todos ?? []).filter((t) => !!t.due_date);

  const todosText =
    todosPlain.length > 0
      ? todosPlain.map((t) => `- [id:${t.id}] ${t.content}`).join("\n")
      : "None";

  // Merge legacy reminder-type items with dated todos into a single reminders block
  const allReminderItems = [
    ...overdueReminders.map((r) => ({
      id: r.id,
      content: r.content,
      label: `OVERDUE: ${r.content}`,
    })),
    ...dueTodayReminders.map((r) => ({
      id: r.id,
      content: r.content,
      label: `Due today: ${r.content}`,
    })),
    ...todosDated.map((t) => {
      const due = new Date(t.due_date!);
      const isOverdue = due < now;
      const prefix = isOverdue
        ? `OVERDUE: ${t.content}`
        : `Due ${t.due_date!.slice(0, 10)}: ${t.content}`;
      return { id: t.id, content: t.content, label: prefix };
    }),
  ];

  const remindersText =
    allReminderItems.length > 0
      ? allReminderItems.map((r) => `- [id:${r.id}] ${r.label}`).join("\n")
      : "None";

  const actionText =
    actionItemsFlat.length > 0
      ? actionItemsFlat
          .map(
            (a) =>
              `- [id:${a.id}] ${a.description}${a.member_name ? ` (re: ${a.member_name})` : ""}${a.due_date ? ` — due ${a.due_date.slice(0, 10)}` : ""}`,
          )
          .join("\n")
      : "None";

  const membersText =
    memberContext.length > 0
      ? memberContext
          .map(
            (m) =>
              `- [id:${m.id}] ${m.name}: last met ${m.daysAgo !== null ? `${m.daysAgo} days ago` : "never"}`,
          )
          .join("\n")
      : "No team members";

  const prompt = `Today is ${today}.

PENDING TODOS — no due date (${todosPlain.length}):
${todosText}

REMINDERS — overdue or with a due date (${allReminderItems.length}):
${remindersText}

OPEN ACTION ITEMS (${actionItemsFlat.length} total):
${actionText}

TODAY'S MEETINGS (${meetingsToday.length}): ${meetingsToday.length > 0 ? meetingsToday.map((m) => m.title).join(", ") : "None"}

TEAM MEMBERS:
${membersText}

Return a prioritised list of items to focus on today, and up to 3 team members to connect with.
Rules for priority_items:
- Use the exact id values from the input (the part after "id:").
- Items from the TODOS section → type "todo".
- Items from the REMINDERS section → type "reminder".
- Items from the OPEN ACTION ITEMS section → type "action_item".`;

  const { object } = await generateObject({
    model: openai("gpt-5.4-mini"),
    system:
      "You are a daily briefing assistant for an engineering manager. Help them prioritise their day and maintain good relationships with their direct reports. Be concise and practical.",
    prompt,
    schema: BriefingSchema,
  });

  // Combine legacy reminder-type items with overdue dated todos for the widget
  const overdueForWidget = [
    ...overdueReminders.map((r) => ({ id: r.id, content: r.content, due_date: r.due_date })),
    ...todosDated
      .filter((t) => new Date(t.due_date!) < now)
      .map((t) => ({ id: t.id, content: t.content, due_date: t.due_date })),
  ];
  const dueTodayForWidget = [
    ...dueTodayReminders.map((r) => ({ id: r.id, content: r.content, due_date: r.due_date })),
    ...todosDated
      .filter((t) => new Date(t.due_date!) >= now)
      .map((t) => ({ id: t.id, content: t.content, due_date: t.due_date })),
  ];

  const content = {
    overdue_reminders: overdueForWidget,
    due_today_reminders: dueTodayForWidget,
    action_items_count: actionItemsFlat.length,
    meetings_today: meetingsToday,
    total_meeting_hours: totalMeetingHours,
    priority_items: object.priority_items,
    suggested_meetings: object.suggested_meetings,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("daily_briefings").upsert(
    {
      user_id: user.id,
      date: today,
      content,
      generated_at: now.toISOString(),
    },
    { onConflict: "user_id,date" },
  );

  if (error) {
    console.error("daily_briefings upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ briefing: content });
}
