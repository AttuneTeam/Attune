import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeamPulsePageClient } from "@/components/team/TeamPulsePageClient";

export default async function TeamPulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Team members
  const { data: members } = await supabase
    .from("team_members")
    .select("id, name, level, start_date, team_id, is_squad_lead")
    .eq("manager_id", user.id)
    .order("name");

  if (!members || members.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Team Pulse</h1>
        <p className="text-muted-foreground mb-6">
          Add team members to start tracking team health.
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

  const memberIds = members.map((m) => m.id);

  // Interactions with sentiment (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: interactions } = await supabase
    .from("interactions")
    .select(
      "id, participant_id, scheduled_at, sentiment_score, key_themes, duration_minutes",
    )
    .eq("manager_id", user.id)
    .eq("status", "completed")
    .gte("scheduled_at", ninetyDaysAgo.toISOString())
    .not("sentiment_score", "is", null)
    .order("scheduled_at", { ascending: true });

  // Build sentiment data for chart
  const sentimentData = (interactions ?? [])
    .filter((i) => memberIds.includes(i.participant_id))
    .map((i) => {
      const member = members.find((m) => m.id === i.participant_id);
      return {
        date: i.scheduled_at,
        score: i.sentiment_score as number,
        memberName: member?.name ?? "Unknown",
      };
    });

  // Build attention tracker metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  // All completed interactions (not just sentiment ones) for cadence calc
  const { data: allInteractions } = await supabase
    .from("interactions")
    .select("participant_id, scheduled_at, duration_minutes")
    .eq("manager_id", user.id)
    .eq("status", "completed")
    .gte("scheduled_at", ninetyDaysAgo.toISOString())
    .order("scheduled_at", { ascending: false });

  const attentionMetrics = members.map((member) => {
    const memberInteractions = (allInteractions ?? []).filter(
      (i) => i.participant_id === member.id,
    );
    const lastInteraction =
      memberInteractions.length > 0 ? memberInteractions[0] : null;
    const daysSinceLastMeeting = lastInteraction
      ? Math.floor(
          (today.getTime() -
            new Date(lastInteraction.scheduled_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;
    const interactionCount30d = memberInteractions.filter(
      (i) => new Date(i.scheduled_at) >= thirtyDaysAgo,
    ).length;

    return {
      name: member.name,
      level: member.level ?? "unknown",
      daysSinceLastMeeting,
      interactionCount30d,
      memberId: member.id,
    };
  });

  const { data: teams } = await supabase.from("teams").select("*").order("name");

  // Aggregate themes
  const { data: allInteractionsWithThemes } = await supabase
    .from("interactions")
    .select("participant_id, key_themes")
    .eq("manager_id", user.id)
    .eq("status", "completed")
    .gte("scheduled_at", ninetyDaysAgo.toISOString())
    .not("key_themes", "is", null);

  const teamThemeCounts: Record<string, Set<string>> = {};
  (allInteractionsWithThemes ?? []).forEach((i) => {
    const member = members.find((m) => m.id === i.participant_id);
    if (!member) return;
    (i.key_themes ?? []).forEach((theme: string) => {
      if (!teamThemeCounts[theme]) teamThemeCounts[theme] = new Set();
      teamThemeCounts[theme].add(member.name);
    });
  });

  const teamThemes = Object.entries(teamThemeCounts)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 20)
    .map(([theme, memberSet]) => ({
      theme,
      count: memberSet.size,
      members: Array.from(memberSet),
    }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Team Pulse</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Synthesised insights across your team based on 1-on-1s, sentiment, and action items.
        </p>
      </div>

      <TeamPulsePageClient
        attentionMetrics={attentionMetrics}
        sentimentData={sentimentData}
        memberNames={members.map((m) => m.name)}
        initialTeamThemes={teamThemes}
        teams={teams ?? []}
        members={members as never}
      />
    </div>
  );
}
