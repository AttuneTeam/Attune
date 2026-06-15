import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardOverflowMenu } from "@/components/dashboard/DashboardOverflowMenu";
import { DashboardPageTabs } from "@/components/dashboard/DashboardPageTabs";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch all direct reports
  const { data: members } = await supabase
    .from("team_members")
    .select("*")
    .order("name");

  if (!members || members.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Team</h1>
        <p className="text-muted-foreground mb-6">
          Welcome! Add your team members to get started.
        </p>
        <Link
          href="/team"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Add team members
        </Link>
      </div>
    );
  }

  // Open action items count per member
  const { data: openActionItems } = await supabase
    .from("action_items")
    .select("interactions!inner(participant_id)")
    .eq("status", "open");

  const openCountByMember: Record<string, number> = {};
  for (const item of openActionItems ?? []) {
    const participantId = (item.interactions as any)?.participant_id;
    if (participantId) {
      openCountByMember[participantId] =
        (openCountByMember[participantId] ?? 0) + 1;
    }
  }

  // Global stats
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const now = new Date();

  const [{ count: meetingsThisMonth }, { data: durationData }] =
    await Promise.all([
      supabase
        .from("interactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("scheduled_at", thisMonthStart.toISOString())
        .lt("scheduled_at", now.toISOString()),
      supabase
        .from("interactions")
        .select("duration_minutes")
        .eq("status", "completed")
        .gte("scheduled_at", thisMonthStart.toISOString())
        .lt("scheduled_at", now.toISOString()),
    ]);

  const totalMinutesThisMonth = (durationData ?? []).reduce(
    (sum, i) => sum + (i.duration_minutes ?? 0),
    0,
  );

  // Upcoming check-ins — all future interactions regardless of status
  const { data: upcomingBookings } = await supabase
    .from("interactions")
    .select("id, title, scheduled_at, agenda, team_members(name)")
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(10);

  // Recent interactions preview
  const { data: recentInteractionsRaw } = await supabase
    .from("interactions")
    .select("id, title, scheduled_at, sentiment_score, team_members(name)")
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false })
    .limit(4);

  const interactionsPreview = (recentInteractionsRaw ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    scheduled_at: i.scheduled_at,
    sentiment_score: i.sentiment_score,
    memberName: (i.team_members as any)?.name ?? "Unknown",
  }));

  // Action items for inline dashboard table
  const { data: actionItemsRaw } = await supabase
    .from("action_items")
    .select(
      "id, title, description, status, due_date, created_at, assignee_id, interactions!left(id, team_members(id, name))",
    )
    .in("status", ["open", "in_progress"])
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    })
    .limit(50);

  // Teams + team values for org chart + Google Calendar token status
  const [{ data: teams }, { data: googleToken }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("user_oauth_tokens")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle(),
  ]);

  const hasGoogleCalendar = !!googleToken;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <div className="flex items-center gap-2">
          <DashboardOverflowMenu
            teams={teams ?? []}
            members={members}
            userId={user.id}
          />
        </div>
      </div>

      <DashboardPageTabs
        userId={user.id}
        hasGoogleCalendar={hasGoogleCalendar}
        interactionsPreview={interactionsPreview}
        totalThisMonth={meetingsThisMonth ?? 0}
        totalMinutesThisMonth={totalMinutesThisMonth}
        upcomingBookings={upcomingBookings ?? []}
        actionItems={(actionItemsRaw ?? []) as never}
        members={members}
      />
    </div>
  );
}
