import { createClient } from "@/lib/supabase/server";
import { NewBookingButton } from "@/components/dashboard/NewBookingButton";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
import { InteractionsSheet } from "@/components/dashboard/InteractionsSheet";
import { OrgStructureSheet } from "@/components/dashboard/OrgStructureSheet";
import { TeamCoverageCard } from "@/components/team/TeamCoverageCard";
import { DashboardActionItems } from "@/components/dashboard/DashboardActionItems";
import { DashboardPageTabs } from "@/components/dashboard/DashboardPageTabs";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
        <a
          href="/team"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Add team members
        </a>
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
  const { count: openItemsCount } = await supabase
    .from("action_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

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
      "id, description, status, due_date, created_at, interactions!inner(id, team_members(id, name))",
    )
    .in("status", ["open", "in_progress"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);

  // Teams + team values for org chart + Google Calendar token status
  const [{ data: teams }, { data: teamValues }, { data: personalItemsRaw }, { data: googleToken }] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("team_values").select("*"),
      supabase
        .from("personal_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_oauth_tokens")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle(),
    ]);

  const hasGoogleCalendar = !!googleToken;

  const teamContent = (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 w-full pt-4">
      {/* ── Col 1: upcoming + insights ── */}
      <div className="space-y-6">
        <div className="space-y-4">
          <InteractionsSheet
            preview={interactionsPreview}
            totalThisMonth={meetingsThisMonth ?? 0}
            totalMinutesThisMonth={totalMinutesThisMonth}
          />
          <TeamCoverageCard />
        </div>
      </div>

      {/* ── Col 2: action items + direct reports ── */}
      <div className="space-y-6">
        <div>
          {upcomingBookings && upcomingBookings.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Upcoming
              </h2>
              <UpcomingList bookings={upcomingBookings as never} />
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Action Items
            </h2>
            <a
              href="/action-items"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </a>
          </div>
          <DashboardActionItems items={(actionItemsRaw ?? []) as never} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <div className="flex items-center gap-2">
          <OrgStructureSheet teams={teams ?? []} members={members} />
          <NewBookingButton members={members} />
        </div>
      </div>

      <DashboardPageTabs
        teamContent={teamContent}
        personalItems={(personalItemsRaw ?? []) as never}
        userId={user.id}
        hasGoogleCalendar={hasGoogleCalendar}
      />
    </div>
  );
}
