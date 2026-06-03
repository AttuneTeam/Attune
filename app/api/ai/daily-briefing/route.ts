import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getValidToken,
  fetchUpcomingEvents,
  fetchMemberMeetingMinutes,
  eventDurationMinutes,
} from "@/lib/google/calendar";

const BriefingSchema = z.object({
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
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data }, { data: members }] = await Promise.all([
    (supabase as any)
      .from("daily_briefings")
      .select("content, date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("team_members")
      .select("id, name")
      .eq("manager_id", user.id)
      .order("name"),
  ]);

  if (!data?.content) return NextResponse.json({ briefing: null });

  return NextResponse.json({
    date: data.date as string,
    briefing: {
      ...data.content,
      team_members: (members ?? []).map((m: { id: string; name: string }) => ({
        id: m.id,
        name: m.name,
      })),
    },
  });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

  const [
    { data: reminders },
    { data: actionItems },
    { data: recentInteractions },
    { data: members },
    { data: yesterdayInteractions },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("action_items")
      .select("id, description, due_date")
      .eq("user_id", user.id)
      .in("status", ["open", "in_progress"])
      .lte("due_date", today)
      .order("due_date", { ascending: true }),
    supabase
      .from("action_items")
      .select(
        "id, description, status, due_date, interactions!left(participant_id, ai_summary, team_members(id, name, level, role_description))",
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
      .select("id, name, email")
      .eq("manager_id", user.id)
      .order("name"),
    supabase
      .from("interactions")
      .select("id, title, scheduled_at, ai_summary, participant_id")
      .eq("manager_id", user.id)
      .gte("scheduled_at", yesterdayStart.toISOString())
      .lte("scheduled_at", yesterdayEnd.toISOString())
      .order("scheduled_at"),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  // Calendar events for today
  let meetingsToday: {
    title: string;
    start: string;
    end: string;
    duration_minutes: number;
  }[] = [];
  let totalMeetingHours = 0;
  let teamMemberHours: { member_id: string; member_name: string; meeting_minutes: number }[] = [];
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

    // Team member meeting hours for today (silently skips inaccessible calendars)
    const membersWithEmail = (members ?? []).filter((m) => m.email);
    teamMemberHours = await Promise.all(
      membersWithEmail.map(async (m) => ({
        member_id: m.id,
        member_name: m.name,
        meeting_minutes: await fetchMemberMeetingMinutes(token, m.email!, todayStart, todayEnd),
      })),
    );
  } catch {
    // Calendar not connected — skip silently
  }

  // Categorise by due date (string comparison is reliable for date-only fields)
  const overdueReminders = (reminders ?? []).filter(
    (r) => r.due_date && r.due_date.slice(0, 10) < today,
  );
  const dueTodayReminders = (reminders ?? []).filter(
    (r) => r.due_date && r.due_date.slice(0, 10) === today,
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

  // Flatten action items with member context
  const actionItemsFlat = (actionItems ?? []).map((a) => {
    const interaction = a.interactions as unknown as Record<
      string,
      unknown
    > | null;
    const member = interaction?.team_members as {
      id: string;
      name: string;
      level: string | null;
      role_description: string | null;
    } | null;
    return {
      id: a.id,
      description: a.description,
      status: a.status,
      due_date: a.due_date,
      member_name: member?.name ?? null,
      member_level: member?.level ?? null,
      member_role: member?.role_description ?? null,
      last_interaction_summary: (interaction?.ai_summary as string | null) ?? null,
    };
  });

  // Yesterday's recap (data-driven, no AI needed)
  const memberById = Object.fromEntries((members ?? []).map((m) => [m.id, m.name]));
  const yesterdayRecap = (yesterdayInteractions ?? []).map((i) => ({
    title: i.title ?? "Interaction",
    member_name: i.participant_id ? (memberById[i.participant_id] ?? null) : null,
    ai_summary: i.ai_summary ?? null,
  }));

  const yesterdayText =
    yesterdayRecap.length > 0
      ? yesterdayRecap
          .map(
            (i) =>
              `- ${i.title}${i.member_name ? ` (with ${i.member_name})` : ""}${i.ai_summary ? `: ${i.ai_summary.slice(0, 150)}` : ""}`,
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

YESTERDAY'S INTERACTIONS (${yesterdayRecap.length}):
${yesterdayText}

TODAY'S MEETINGS (${meetingsToday.length}): ${meetingsToday.length > 0 ? meetingsToday.map((m) => m.title).join(", ") : "None"}

TEAM MEMBERS:
${membersText}

Return up to 3 team members the manager should consider connecting with today.`;

  const { object } = await generateObject({
    model: openai("gpt-5.5"),
    system:
      `You are a daily briefing assistant for a manager${profile?.role ? ` (${profile.role})` : ""}. Help them maintain good relationships with their direct reports. Be concise and practical.`,
    prompt,
    schema: BriefingSchema,
  });

  const overdueForWidget = overdueReminders.map((r) => ({
    id: r.id,
    content: r.description,
    due_date: r.due_date,
  }));
  const dueTodayForWidget = dueTodayReminders.map((r) => ({
    id: r.id,
    content: r.description,
    due_date: r.due_date,
  }));
  const dueTodayActionItems = actionItemsFlat.filter(
    (a) => a.due_date && a.due_date.slice(0, 10) === today,
  );

  const content = {
    overdue_reminders: overdueForWidget,
    due_today_reminders: dueTodayForWidget,
    due_today_action_items: dueTodayActionItems.map((a) => ({
      id: a.id,
      description: a.description,
      member_name: a.member_name,
    })),
    action_items_count: actionItemsFlat.length,
    meetings_today: meetingsToday,
    total_meeting_hours: totalMeetingHours,
    suggested_meetings: object.suggested_meetings,
    team_members: (members ?? []).map((m) => ({ id: m.id, name: m.name })),
    yesterday_recap: { interactions: yesterdayRecap },
    team_member_hours: teamMemberHours,
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

  return NextResponse.json({ date: today, briefing: content });
}
