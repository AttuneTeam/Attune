import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format, differenceInDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Mail,
  Briefcase,
  Clock,
  ExternalLink,
  Zap,
} from "lucide-react";
import { SentimentInsightsCard } from "@/components/team/SentimentInsightsCard";
import { NewInteractionButton } from "@/components/dashboard/NewMeetingButton";
import { MemberHeaderMenu } from "@/components/team/MemberHeaderMenu";
import { GitHubCard } from "@/components/team/GitHubCard";
import { GitHubSummaryTile } from "@/components/team/GitHubSummaryTile";
import { fetchAllIntegrations } from "@/lib/integrations";
import type { IntegrationResult } from "@/lib/integrations";
import { InteractionsTabs } from "@/components/team/InteractionsTabs";
import { SlackCard } from "@/components/team/SlackCard";
import type { MemberGoal, GoalTemplate, Role } from "@/lib/supabase/types";
import { formatTenure } from "@/lib/tenure";
import { MeetingLoadChart } from "@/components/team/MeetingLoadChart";

type InteractionRow = {
  id: string;
  title: string | null;
  scheduled_at: string;
  sentiment_score: number | null;
  ai_summary: string | null;
  key_themes: string[];
  type: string;
};

function sentimentBadge(score: number): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (score >= 0.3) return { label: "Positive", variant: "default" };
  if (score >= -0.3) return { label: "Neutral", variant: "secondary" };
  return { label: "Concerning", variant: "destructive" };
}

function topThemes(interactions: InteractionRow[]): string[] {
  const counts: Record<string, number> = {};
  for (const m of interactions) {
    for (const theme of m.key_themes ?? []) {
      counts[theme] = (counts[theme] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme]) => theme);
}


function IntegrationCard({ result }: { result: IntegrationResult }) {
  return (
    <div className="rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{result.label}</h2>
        {result.profileUrl && (
          <a
            href={result.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto flex items-center gap-1"
          >
            @{result.handle}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {result.error ? (
        <p className="text-xs text-destructive">{result.error}</p>
      ) : result.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No recent activity found.
        </p>
      ) : (
        <ul className="space-y-2">
          {result.items.slice(0, 10).map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              <Badge
                variant={
                  item.status === "merged" ||
                  item.status === "published" ||
                  item.status === "done"
                    ? "secondary"
                    : item.status === "open"
                      ? "secondary"
                      : "outline"
                }
                className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5 capitalize"
              >
                {item.status}
              </Badge>
              <div className="flex-1 min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:underline underline-offset-2 line-clamp-1"
                >
                  {item.title}
                </a>
                <p className="text-muted-foreground truncate">
                  {item.subtitle}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("*")
    .eq("id", id)
    .single();

  if (!member) notFound();

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .order("name");

  const { data: interactionsRaw } = await supabase
    .from("interactions")
    .select(
      "id, title, scheduled_at, sentiment_score, ai_summary, key_themes, type",
    )
    .eq("participant_id", id)
    .order("scheduled_at", { ascending: false });

  const interactions = (interactionsRaw ?? []) as InteractionRow[];
  const { data: actionItems } = await supabase
    .from("action_items")
    .select("*")
    .eq("assignee_id", id)
    .order("created_at", { ascending: false });

  const items = (actionItems ?? []) as Array<{
    id: string;
    title: string | null;
    description: string;
    status: string;
    due_date: string | null;
    assignee_id: string | null;
    interaction_id: string | null;
  }>;

  // Derived
  const lastInteraction = interactions[0] ?? null;
  const daysSince = lastInteraction
    ? differenceInDays(new Date(), parseISO(lastInteraction.scheduled_at))
    : null;

  const withScore = interactions.filter((m) => m.sentiment_score !== null);
  const avgSentiment =
    withScore.length > 0
      ? withScore.reduce((sum, m) => sum + (m.sentiment_score as number), 0) /
        withScore.length
      : null;

  const sentimentHistory = [...interactions]
    .filter((m) => m.sentiment_score !== null)
    .reverse()
    .map((m) => ({ date: m.scheduled_at, score: m.sentiment_score as number }));

  const themes = topThemes(interactions);
  const nudges =
    member.coaching_nudges ??
    (daysSince !== null && daysSince > 21
      ? [
          {
            text: `It's been ${daysSince} days since the last 1-on-1 — consider scheduling one soon.`,
            theme: "check-in",
          },
        ]
      : []);

  const teamName = teams?.find((t) => t.id === member.team_id)?.name ?? null;

  const { data: memberIntegrations } = await supabase
    .from("team_member_integrations")
    .select("*")
    .eq("member_id", id);

  const githubIntegration =
    memberIntegrations?.find((i) => i.provider === "github") ?? null;
  const otherIntegrations = (memberIntegrations ?? []).filter(
    (i) => i.provider !== "github",
  );

  const integrationResults: IntegrationResult[] = otherIntegrations.length
    ? await fetchAllIntegrations(
        otherIntegrations.map((i) => ({
          provider: i.provider,
          handle: i.handle,
          config: i.config ?? {},
        })),
      )
    : [];

  const { data: goalsRaw } = await supabase
    .from("member_goals")
    .select("*")
    .eq("member_id", id)
    .order("year", { ascending: false });

  const { data: templatesRaw } = await supabase
    .from("goal_templates")
    .select("*")
    .eq("manager_id", user.id)
    .order("title");

  const goals = (goalsRaw ?? []) as MemberGoal[];
  const goalTemplates = (templatesRaw ?? []) as GoalTemplate[];

  // Fetch assigned role + its areas
  const assignedRole = member.role_id
    ? await supabase
        .from("roles")
        .select("id, title")
        .eq("id", member.role_id)
        .single()
        .then(({ data }) => data as Pick<Role, "id" | "title"> | null)
    : null;

  // const roleAreasList = member.role_id
  //   ? await supabase
  //       .from("role_areas")
  //       .select("id, title")
  //       .eq("role_id", member.role_id)
  //       .order("display_order", { ascending: true })
  //       .order("created_at", { ascending: true })
  //       .then(({ data }) => (data ?? []) as Pick<RoleArea, "id" | "title">[])
  //   : ([] as Pick<RoleArea, "id" | "title">[]);

  const { data: allRoles } = await supabase
    .from("roles")
    .select("*")
    .eq("manager_id", user.id)
    .order("title");

  // Meeting hours history from daily briefings
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: briefingHistory } = await (supabase as any)
    .from("daily_briefings")
    .select("date, content")
    .eq("user_id", user.id)
    .gte("date", fourteenDaysAgoStr)
    .order("date", { ascending: false })
    .limit(14);

  type HoursEntry = { member_id: string; member_name: string; meeting_minutes: number };
  const memberHoursHistory = ((briefingHistory ?? []) as { date: string; content: Record<string, unknown> }[]).flatMap((row) => {
    const hours = (row.content?.team_member_hours as HoursEntry[] | undefined) ?? [];
    const entry = hours.find((h) => h.member_id === id);
    return entry ? [{ date: row.date, minutes: entry.meeting_minutes }] : [];
  });
  const todayMeetingMinutes = memberHoursHistory.find((h) => h.date === todayStr)?.minutes ?? null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-fit">
            <NewInteractionButton
              memberId={member.id}
              memberName={member.name}
            />
          </div>
          <MemberHeaderMenu
            member={member}
            teams={teams ?? []}
            roles={allRoles ?? []}
            managerId={user.id}
            integrations={memberIntegrations ?? []}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="space-y-6">
          {/* Details */}
          <div className="rounded-lg bg-card px-0 pt-0 pb-0 space-y-4">
            {/* Name as card title */}
            <div>
              <h2 className="text-xl font-bold tracking-tight leading-tight">
                {member.name}
              </h2>

              {/* Role — just above Skills */}
              {assignedRole && (
                <div className="space-y-2">
                  <Link
                    href={`/roles/${assignedRole.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline underline-offset-2"
                  >
                    {assignedRole.title}
                  </Link>
                </div>
              )}
              {(member.level || teamName || member.relationship) && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {teamName && (
                    <Badge variant="outline" className="text-xs">
                      {teamName}
                    </Badge>
                  )}
                  {member.is_squad_lead && (
                    <Badge
                      variant="outline"
                      className="text-xs text-primary border-primary/40"
                    >
                      Squad Lead
                    </Badge>
                  )}
                  {member.relationship === "stakeholder" && (
                    <Badge variant="secondary" className="text-xs">
                      Stakeholder / Peer
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Meta info */}
            <div className="space-y-2.5 text-sm">
              {member.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}
              {member.start_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Joined{" "}
                    {format(new Date(member.start_date), "MMM d, yyyy")}{" "}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {member.start_date ? formatTenure(member.start_date) : "—"}
                  </Badge>
                </div>
              )}
              {/* <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {interactions.length}{" "}
                  {interactions.length === 1 ? "interaction" : "interactions"}{" "}
                  total
                </span>
              </div> */}
              {daysSince !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Last interaction
                  </span>
                  <Badge
                    variant={daysSince > 14 ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {daysSince === 0 ? "Today" : `${daysSince}d ago`}
                  </Badge>
                </div>
              )}
              {todayMeetingMinutes !== null && todayMeetingMinutes > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {Math.round((todayMeetingMinutes / 60) * 10) / 10}h in meetings today
                  </span>
                </div>
              )}
              {memberHoursHistory.length > 1 && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-1.5">Meeting load (last {memberHoursHistory.length} days)</p>
                  <MeetingLoadChart history={memberHoursHistory} />
                </div>
              )}
            </div>

            {!assignedRole && member.role_description && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {member.role_description}
                </p>
              </div>
            )}
          </div>

          {(() => {
            const leftResults = integrationResults.filter(
              (r) => r.provider !== "slack",
            );
            if (leftResults.length === 0) return null;
            return leftResults.map((result) => (
              <IntegrationCard key={result.provider} result={result} />
            ));
          })()}

          {/* AI Insights */}
          <SentimentInsightsCard
            avgSentiment={avgSentiment}
            sentimentHistory={sentimentHistory}
            themes={themes}
            nudges={nudges}
            meetingCount={withScore.length}
            managerRead={member.manager_read ?? []}
            memberName={member.name}
          />

        </div>

        {/* ── Right column ── */}
        <div className="lg:col-span-2 space-y-4">
          {(githubIntegration ||
            integrationResults.some((r) => r.provider === "slack")) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {githubIntegration && (
                <GitHubSummaryTile
                  handle={githubIntegration.handle}
                  repo={githubIntegration.config?.repo}
                />
              )}
              {integrationResults
                .filter((r) => r.provider === "slack")
                .map((result) => (
                  <SlackCard key={result.provider} result={result} />
                ))}
            </div>
          )}
          <InteractionsTabs
            interactions={interactions}
            items={items}
            memberId={member.id}
            managerId={user.id}
            goals={goals}
            goalTemplates={goalTemplates}
          />
        </div>
      </div>
    </div>
  );
}
