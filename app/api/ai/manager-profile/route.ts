import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { formatOrgContext, MANAGER_PROFILE_SYSTEM } from "@/lib/ai/prompts";

const ManagerProfileSchema = z.object({
  archetype: z.object({
    label: z
      .enum(["Firefighter", "Operator", "Strategist", "Coach", "Explorer", "Reflector"])
      .describe("Dominant management archetype for this period"),
    explanation: z.string().describe("1–2 sentence justification grounded in the data"),
  }),
  managerial_summary: z
    .string()
    .describe("Concise paragraph describing how the manager operated during this period"),
  map_scores: z.object({
    direction: z.number().min(0).max(10).describe("Strategic thinking and long-term planning"),
    delivery: z.number().min(0).max(10).describe("Execution focus and getting things done"),
    people: z.number().min(0).max(10).describe("Coaching, development, relationships"),
    ideas: z.number().min(0).max(10).describe("Innovation and exploration"),
    judgement: z.number().min(0).max(10).describe("Decision-making and critical thinking"),
    self: z.number().min(0).max(10).describe("Reflection and self-awareness"),
  }),
  problem_patterns: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Most common types of challenges handled"),
  behavioural_insights: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe("Interpretation of patterns — what they reveal about how the manager operates"),
  strengths: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe("Key capabilities demonstrated through behaviour"),
  growth_edge: z
    .array(z.string())
    .min(1)
    .max(2)
    .describe("High-impact areas for improvement"),
  reflection_prompts: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Questions to help the manager evaluate their own behaviour"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const period: "monthly" | "quarterly" = body.period === "monthly" ? "monthly" : "quarterly";

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - (period === "monthly" ? 30 : 90));

    const today = new Date();

    // ── Fetch all data in parallel ──────────────────────────────────────────

    const [
      { data: interactions },
      { data: initiatives },
      { data: personalItems },
      { data: orgContext },
      { data: profile },
      { data: roles },
    ] = await Promise.all([
      supabase
        .from("interactions")
        .select("id, type, sentiment_score, key_themes, duration_minutes, ai_summary")
        .eq("manager_id", user.id)
        .eq("status", "completed")
        .gte("scheduled_at", windowStart.toISOString()),
      supabase
        .from("strategic_initiatives")
        .select("title, status, domain, horizon, tags")
        .eq("manager_id", user.id),
      supabase
        .from("personal_items")
        .select("type, status, created_at")
        .eq("user_id", user.id)
        .gte("created_at", windowStart.toISOString()),
      supabase.from("org_context").select("*").eq("manager_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name, role, role_ids").eq("id", user.id).single(),
      supabase.from("roles").select("id, title").eq("manager_id", user.id),
    ]);

    // Fetch action items for interactions in the window
    const interactionIds = (interactions ?? []).map((i) => i.id);
    const { data: actionItems } =
      interactionIds.length > 0
        ? await supabase
            .from("action_items")
            .select("status, due_date")
            .in("interaction_id", interactionIds)
        : { data: [] as Array<{ status: string; due_date: string | null }> };

    // ── Compute aggregates ──────────────────────────────────────────────────

    const allInteractions = interactions ?? [];
    const totalHours = Math.round(
      allInteractions.reduce((s, i) => s + (i.duration_minutes ?? 0), 0) / 60,
    );

    const typeCounts: Record<string, number> = {};
    for (const i of allInteractions) {
      typeCounts[i.type] = (typeCounts[i.type] ?? 0) + 1;
    }

    const sentimentValues = allInteractions
      .map((i) => i.sentiment_score)
      .filter((s): s is number => s !== null);
    const avgSentiment =
      sentimentValues.length > 0
        ? (sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length).toFixed(2)
        : null;

    const themeCounts: Record<string, number> = {};
    for (const i of allInteractions) {
      for (const t of i.key_themes ?? []) {
        themeCounts[t] = (themeCounts[t] ?? 0) + 1;
      }
    }
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([theme, count]) => `${theme} (${count}x)`);

    const allInitiatives = initiatives ?? [];
    const activeInitiatives = allInitiatives.filter((i) => i.status === "active");
    const completedInitiatives = allInitiatives.filter((i) => i.status === "completed");
    const pausedInitiatives = allInitiatives.filter((i) => i.status === "paused");

    const allActionItems = actionItems ?? [];
    const doneItems = allActionItems.filter((a) => a.status === "done");
    const openItems = allActionItems.filter(
      (a) => a.status === "open" || a.status === "in_progress",
    );
    const overdueItems = openItems.filter(
      (a) => a.due_date && new Date(a.due_date) < today,
    );

    const allPersonalItems = personalItems ?? [];
    const todos = allPersonalItems.filter((p) => p.type === "todo");
    const doneTodos = todos.filter((p) => p.status === "done");
    const notes = allPersonalItems.filter((p) => p.type === "note");

    const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r.title]));
    const linkedRoleTitles = (profile?.role_ids ?? [])
      .map((id: string) => roleMap[id])
      .filter(Boolean);

    // ── Build prompt ────────────────────────────────────────────────────────

    const periodLabel =
      period === "monthly"
        ? `Last 30 days (${windowStart.toISOString().split("T")[0]} – ${today.toISOString().split("T")[0]})`
        : `Last 90 days / quarter (${windowStart.toISOString().split("T")[0]} – ${today.toISOString().split("T")[0]})`;

    const orgBlock = formatOrgContext(orgContext ?? null);

    const interactionsBlock = [
      `Interactions: ${allInteractions.length} completed (${totalHours} hours)`,
      `  Type breakdown: ${Object.entries(typeCounts)
        .map(([t, c]) => `${t}: ${c}`)
        .join(", ")}`,
      avgSentiment ? `  Avg sentiment: ${avgSentiment} (scale: -1 to 1)` : null,
      topThemes.length > 0 ? `  Top themes: ${topThemes.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const initiativesBlock = [
      `Strategic Initiatives:`,
      `  Active (${activeInitiatives.length}): ${
        activeInitiatives.map((i) => `${i.title}${i.domain ? ` [${i.domain}]` : ""}`).join("; ") || "none"
      }`,
      `  Completed this period: ${completedInitiatives.length}`,
      `  Paused: ${pausedInitiatives.length}`,
    ].join("\n");

    const actionItemsBlock = `Action Items: total ${allActionItems.length} | done ${doneItems.length} | open ${openItems.length} | overdue ${overdueItems.length}`;

    const personalBlock = `Personal items: ${todos.length} todos (${doneTodos.length} done), ${notes.length} notes`;

    const roleBlock =
      linkedRoleTitles.length > 0
        ? `Linked role definitions: ${linkedRoleTitles.join(", ")}`
        : null;

    const prompt = [
      `Period: ${periodLabel}`,
      `Manager: ${profile?.full_name ?? "Unknown"}, Role: ${profile?.role ?? "Unknown"}`,
      orgBlock,
      interactionsBlock,
      initiativesBlock,
      actionItemsBlock,
      personalBlock,
      roleBlock,
    ]
      .filter(Boolean)
      .join("\n\n");

    // ── Generate ────────────────────────────────────────────────────────────

    const { object } = await generateObject({
      model: openai("gpt-5.4"),
      system: MANAGER_PROFILE_SYSTEM,
      prompt,
      schema: ManagerProfileSchema,
    });

    // ── Persist ─────────────────────────────────────────────────────────────

    await supabase
      .from("manager_profile_snapshots")
      .delete()
      .eq("manager_id", user.id);

    await supabase.from("manager_profile_snapshots").insert({
      manager_id: user.id,
      period,
      result: object,
    });

    const { data: saved } = await supabase
      .from("manager_profile_snapshots")
      .select("generated_at")
      .eq("manager_id", user.id)
      .single();

    return NextResponse.json({ ...object, period, generated_at: saved?.generated_at ?? null });
  } catch (error) {
    console.error("Manager profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      .from("manager_profile_snapshots")
      .select("result, period, generated_at")
      .eq("manager_id", user.id)
      .single();

    if (!data) return NextResponse.json(null);

    return NextResponse.json({
      ...data.result,
      period: data.period,
      generated_at: data.generated_at,
    });
  } catch (error) {
    console.error("Manager profile load error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
