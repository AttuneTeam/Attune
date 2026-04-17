import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { formatOrgContext, TEAM_PULSE_SYSTEM } from "@/lib/ai/prompts";

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Load all team members
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name, level, skills, start_date")
      .eq("manager_id", user.id)
      .eq("relationship", "direct_report")
      .order("name");

    if (!members || members.length === 0) {
      return NextResponse.json(
        { error: "No team members found" },
        { status: 400 },
      );
    }

    const memberIds = members.map((m) => m.id);

    // Load interactions from last 90 days (completed only)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: interactions } = await supabase
      .from("interactions")
      .select(
        "id, participant_id, scheduled_at, sentiment_score, key_themes, duration_minutes, status",
      )
      .eq("manager_id", user.id)
      .eq("status", "completed")
      .gte("scheduled_at", ninetyDaysAgo.toISOString())
      .order("scheduled_at", { ascending: false });

    // Load action items for all members
    const { data: actionItems } = await supabase
      .from("action_items")
      .select(
        "id, assignee_id, status, due_date, interactions!inner(participant_id)",
      )
      .in("interactions.participant_id", memberIds);

    // Load goals for current quarter
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

    const { data: goals } = await supabase
      .from("member_goals")
      .select("member_id, status, period_type, year, period")
      .eq("manager_id", user.id)
      .in("member_id", memberIds);

    // Load org context
    const { data: orgContext } = await supabase
      .from("org_context")
      .select("*")
      .eq("manager_id", user.id)
      .single();

    // ── Compute per-member metrics ────────────────────────────────────────────

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const memberMetrics = members.map((member) => {
      const memberInteractions = (interactions ?? []).filter(
        (i) => i.participant_id === member.id,
      );

      // Sentiment
      const withSentiment = memberInteractions.filter(
        (i) => i.sentiment_score !== null,
      );
      const last5 = withSentiment.slice(0, 5);
      const prior5 = withSentiment.slice(5, 10);
      const avgLast5 =
        last5.length > 0
          ? last5.reduce((s, i) => s + (i.sentiment_score ?? 0), 0) /
            last5.length
          : null;
      const avgPrior5 =
        prior5.length > 0
          ? prior5.reduce((s, i) => s + (i.sentiment_score ?? 0), 0) /
            prior5.length
          : null;
      const sentimentDelta =
        avgLast5 !== null && avgPrior5 !== null
          ? +(avgLast5 - avgPrior5).toFixed(2)
          : null;

      // Last meeting date
      const lastInteraction =
        memberInteractions.length > 0 ? memberInteractions[0] : null;
      const daysSinceLastMeeting = lastInteraction
        ? Math.floor(
            (today.getTime() -
              new Date(lastInteraction.scheduled_at).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      // Meeting cadence (last 30 days)
      const interactionsLast30d = memberInteractions.filter(
        (i) => new Date(i.scheduled_at) >= thirtyDaysAgo,
      );
      const totalMinutesLast30d = interactionsLast30d.reduce(
        (s, i) => s + (i.duration_minutes ?? 0),
        0,
      );

      // Top themes (last 10 interactions)
      const themeCounts: Record<string, number> = {};
      memberInteractions.slice(0, 10).forEach((i) => {
        (i.key_themes ?? []).forEach((t: string) => {
          themeCounts[t] = (themeCounts[t] ?? 0) + 1;
        });
      });
      const topThemes = Object.entries(themeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([theme]) => theme);

      // Action items
      const memberActionItems = (actionItems ?? []).filter((ai) => {
        const participantId = (ai.interactions as any)?.participant_id;
        return (
          ai.assignee_id === member.id ||
          participantId === member.id
        );
      });
      const openItems = memberActionItems.filter(
        (ai) => ai.status === "open" || ai.status === "in_progress",
      );
      const overdueItems = openItems.filter(
        (ai) => ai.due_date && new Date(ai.due_date) < today,
      );

      // Goals
      const memberGoals = (goals ?? []).filter(
        (g) => g.member_id === member.id,
      );
      const hasCurrentQuarterGoals = memberGoals.some(
        (g) =>
          g.period_type === "quarterly" &&
          g.year === currentYear &&
          g.period === currentQuarter,
      );

      return {
        name: member.name,
        level: member.level ?? "unknown",
        tenureDays: member.start_date
          ? Math.floor(
              (today.getTime() - new Date(member.start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
        avgSentimentLast5: avgLast5 !== null ? +avgLast5.toFixed(2) : null,
        sentimentDelta,
        daysSinceLastMeeting,
        interactionCount30d: interactionsLast30d.length,
        totalMinutes30d: totalMinutesLast30d,
        topThemes,
        openActionItems: openItems.length,
        overdueActionItems: overdueItems.length,
        hasCurrentQuarterGoals,
      };
    });

    // ── Aggregate team themes ─────────────────────────────────────────────────

    const teamThemeCounts: Record<string, Set<string>> = {};
    (interactions ?? []).forEach((i) => {
      const member = members.find((m) => m.id === i.participant_id);
      if (!member) return;
      (i.key_themes ?? []).forEach((theme: string) => {
        if (!teamThemeCounts[theme]) teamThemeCounts[theme] = new Set();
        teamThemeCounts[theme].add(member.name);
      });
    });

    // ── Build AI prompt ───────────────────────────────────────────────────────

    const orgContextBlock = formatOrgContext(orgContext ?? null);

    const metricsBlock = memberMetrics
      .map((m) => {
        const lines = [`${m.name} (${m.level})`];
        if (m.daysSinceLastMeeting !== null)
          lines.push(`  - Last 1-on-1: ${m.daysSinceLastMeeting} days ago`);
        else lines.push(`  - Last 1-on-1: no record`);
        lines.push(`  - 1-on-1s in last 30 days: ${m.interactionCount30d}`);
        if (m.avgSentimentLast5 !== null) {
          const delta =
            m.sentimentDelta !== null
              ? ` (${m.sentimentDelta > 0 ? "+" : ""}${m.sentimentDelta} vs prior period)`
              : "";
          lines.push(
            `  - Avg sentiment (last 5): ${m.avgSentimentLast5.toFixed(2)}${delta}`,
          );
        } else {
          lines.push(`  - Avg sentiment: no data`);
        }
        if (m.topThemes.length > 0)
          lines.push(`  - Recurring themes: ${m.topThemes.join(", ")}`);
        lines.push(
          `  - Open action items: ${m.openActionItems} (${m.overdueActionItems} overdue)`,
        );
        lines.push(
          `  - Has Q${currentQuarter} ${currentYear} goals: ${m.hasCurrentQuarterGoals ? "yes" : "no"}`,
        );
        return lines.join("\n");
      })
      .join("\n\n");

    const topTeamThemes = Object.entries(teamThemeCounts)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10)
      .map(([theme, memberSet]) => `${theme} (${memberSet.size} people)`);

    const prompt = [
      orgContextBlock,
      `Team of ${members.length} (today is ${today.toISOString().split("T")[0]}):\n\n${metricsBlock}`,
      topTeamThemes.length > 0
        ? `Most common themes across team:\n${topTeamThemes.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { object } = await generateObject({
      model: openai("gpt-5.4"),
      system: TEAM_PULSE_SYSTEM,
      prompt,
      schema: z.object({
        insights: z
          .array(
            z.object({
              headline: z
                .string()
                .describe("Specific, actionable headline naming people/numbers"),
              detail: z
                .string()
                .describe(
                  "1-2 sentences: what the data shows and what to do about it",
                ),
              type: z.enum(["risk", "pattern", "opportunity"]),
              priority: z.enum(["high", "medium", "low"]),
              members: z.array(z.string()).describe("Names of affected members"),
            }),
          )
          .describe("5-8 ranked insights for the manager"),
      }),
    });

    // Persist snapshot
    await supabase
      .from("team_pulse_snapshots")
      .delete()
      .eq("manager_id", user.id);

    const { error: insertError } = await supabase
      .from("team_pulse_snapshots")
      .insert({ manager_id: user.id, result: object });

    if (insertError) {
      console.error("Failed to save pulse snapshot:", insertError);
    }

    const { data: saved } = await supabase
      .from("team_pulse_snapshots")
      .select("generated_at")
      .eq("manager_id", user.id)
      .single();

    // Also return the computed metrics for the frontend data views
    return NextResponse.json({
      ...object,
      member_metrics: memberMetrics,
      team_themes: Object.entries(teamThemeCounts)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 20)
        .map(([theme, memberSet]) => ({
          theme,
          count: memberSet.size,
          members: Array.from(memberSet),
        })),
      generated_at: saved?.generated_at ?? null,
    });
  } catch (error) {
    console.error("Team pulse error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await supabase
      .from("team_pulse_snapshots")
      .select("result, generated_at")
      .eq("manager_id", user.id)
      .single();

    if (!data) return NextResponse.json(null);

    return NextResponse.json({
      ...data.result,
      generated_at: data.generated_at,
    });
  } catch (error) {
    console.error("Team pulse load error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
