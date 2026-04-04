import { createClient } from "@/lib/supabase/server";
import { TeamMemberCard } from "@/components/dashboard/TeamMemberCard";
import { NewBookingButton } from "@/components/dashboard/NewBookingButton";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
import { InteractionsSheet } from "@/components/dashboard/InteractionsSheet";
import { ActionItemsSheet } from "@/components/dashboard/ActionItemsSheet";
import { OrgStructureSheet } from "@/components/dashboard/OrgStructureSheet";
import { TeamCoverageCard } from "@/components/team/TeamCoverageCard";
import { redirect } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";

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

  // Per-member: most recent interaction + latest sentiment score
  const memberData = await Promise.all(
    members.map(async (member) => {
      const { data: recentInteractions } = await supabase
        .from("interactions")
        .select("id, scheduled_at, sentiment_score")
        .eq("participant_id", member.id)
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false })
        .limit(1);

      const lastInteraction = recentInteractions?.[0] ?? null;
      const daysSince = lastInteraction
        ? differenceInDays(new Date(), parseISO(lastInteraction.scheduled_at))
        : null;
      const currentSentiment = lastInteraction?.sentiment_score ?? null;

      return { member, daysSince, currentSentiment };
    }),
  );

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
  const { count: meetingsThisMonth } = await supabase
    .from("interactions")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("scheduled_at", thisMonthStart.toISOString());

  // Upcoming check-ins
  const { data: upcomingBookings } = await supabase
    .from("interactions")
    .select("id, title, scheduled_at, agenda, team_members(name)")
    .eq("status", "upcoming")
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

  // Open action items preview
  const { data: openItemsPreviewRaw } = await supabase
    .from("action_items")
    .select(
      "id, description, status, due_date, interactions!inner(participant_id, team_members(name))",
    )
    .eq("status", "open")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(4);

  const actionItemsPreview = (openItemsPreviewRaw ?? []).map((i) => ({
    id: i.id,
    description: i.description,
    status: i.status,
    due_date: i.due_date,
    memberName:
      ((i.interactions as any)?.team_members as any)?.name ?? "Unknown",
  }));

  // Teams + team values for org chart
  const [{ data: teams }, { data: teamValues }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("team_values").select("*"),
  ]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div />
        <div className="flex items-center gap-2">
          <OrgStructureSheet teams={teams ?? []} members={members} />
          <NewBookingButton members={members} />
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-6">
        {/* ── Col 1: upcoming + summary tiles ── */}
        <div className="space-y-4">
          {upcomingBookings && upcomingBookings.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Upcoming ({upcomingBookings.length})
              </h2>
              <UpcomingList bookings={upcomingBookings as never} />
            </div>
          )}

          {/* <InteractionsSheet
            preview={interactionsPreview}
            totalThisMonth={meetingsThisMonth ?? 0}
          />
          <ActionItemsSheet
            preview={actionItemsPreview}
            totalOpen={openItemsCount ?? 0}
          /> */}
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Insights
          </h2>
          <TeamCoverageCard />
        </div>

        {/* ── Col 2 ── */}
        <div>
          <div>
            <InteractionsSheet
              preview={interactionsPreview}
              totalThisMonth={meetingsThisMonth ?? 0}
            />
            <ActionItemsSheet
              preview={actionItemsPreview}
              totalOpen={openItemsCount ?? 0}
            />
          </div>
        </div>

        {/* ── Col 3 ── */}
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Direct Reports ({members.length})
          </h2>
          <div className="space-y-1">
            {memberData.map(({ member, daysSince, currentSentiment }) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                daysSince={daysSince}
                currentSentiment={currentSentiment}
                openActionCount={openCountByMember[member.id] ?? 0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
