import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  extractPlainText,
  formatOrgContext,
  COVERAGE_SYSTEM,
} from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Load all members with their assigned role
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name, level, role_id, role_description")
      .eq("manager_id", user.id)
      .order("name");

    if (!members || members.length === 0) {
      return NextResponse.json(
        { error: "No team members found" },
        { status: 400 },
      );
    }

    // Load all roles and their areas for this manager
    const { data: roles } = await supabase
      .from("roles")
      .select("id, title")
      .eq("manager_id", user.id);

    const roleIds = (roles ?? []).map((r) => r.id);
    const { data: roleAreas } = roleIds.length
      ? await supabase
          .from("role_areas")
          .select("role_id, title, description")
          .in("role_id", roleIds)
          .order("display_order", { ascending: true })
      : { data: [] };

    const roleMap = Object.fromEntries(
      (roles ?? []).map((r) => [r.id, r.title]),
    );
    const areasByRole: Record<string, typeof roleAreas> = {};
    for (const area of roleAreas ?? []) {
      if (!areasByRole[area.role_id]) areasByRole[area.role_id] = [];
      areasByRole[area.role_id]!.push(area);
    }

    // Load org context for AI grounding
    const { data: orgContext } = await supabase
      .from("org_context")
      .select("*")
      .eq("manager_id", user.id)
      .single();

    // Build prompt context
    const teamSnapshot = members
      .map((m) => {
        const roleName = m.role_id ? roleMap[m.role_id] : null;
        const areas = m.role_id ? (areasByRole[m.role_id] ?? []) : [];
        const areaLines = areas.length
          ? areas
              .map((a) => {
                const desc = extractPlainText(a.description);
                return `  - ${a.title || "Untitled"}${desc ? `: ${desc.slice(0, 200)}` : ""}`;
              })
              .join("\n")
          : "  (no role areas defined)";

        const roleLabel = roleName
          ? `Role: ${roleName}`
          : m.role_description
            ? `Role: ${m.role_description}`
            : "(no role assigned)";

        return `${m.name} (${m.level ?? "unknown level"}) — ${roleLabel}\n${areaLines}`;
      })
      .join("\n\n");

    const orgContextBlock = formatOrgContext(orgContext ?? null);
    const prompt = [
      orgContextBlock,
      `Team of ${members.length} members:\n\n${teamSnapshot}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { object } = await generateObject({
      model: openai("gpt-5.4"),
      system: COVERAGE_SYSTEM,
      prompt,
      schema: z.object({
        strengths: z
          .array(
            z.object({
              area: z.string().describe("The capability or role area"),
              detail: z.string().describe("Why this is a strength"),
            }),
          )
          .describe("Well-covered capability areas"),
        gaps: z
          .array(
            z.object({
              area: z.string().describe("The missing or thin capability"),
              severity: z.enum(["critical", "moderate", "low"]),
              suggestion: z.string().describe("What to do about this gap"),
            }),
          )
          .describe("Coverage gaps across the team"),
        spofs: z
          .array(
            z.object({
              member: z
                .string()
                .describe("Person who is the single point of failure"),
              area: z.string().describe("The capability they solely own"),
              risk: z.string().describe("What happens if unavailable"),
            }),
          )
          .describe("Single points of failure"),
        overlaps: z
          .array(
            z.object({
              area: z.string(),
              members: z.array(z.string()),
              note: z
                .string()
                .describe(
                  "Whether this is healthy redundancy or unclear ownership",
                ),
            }),
          )
          .describe("Areas with significant overlap"),
      }),
    });

    // Persist snapshot (upsert: one row per manager, replace on re-analyse)
    await supabase
      .from("team_coverage_snapshots")
      .delete()
      .eq("manager_id", user.id);

    const { error: insertError } = await supabase
      .from("team_coverage_snapshots")
      .insert({ manager_id: user.id, result: object });

    if (insertError) {
      console.error("Failed to save coverage snapshot:", insertError);
    }

    const { data: saved } = await supabase
      .from("team_coverage_snapshots")
      .select("generated_at")
      .eq("manager_id", user.id)
      .single();

    return NextResponse.json({
      ...object,
      generated_at: saved?.generated_at ?? null,
    });
  } catch (error) {
    console.error("Team coverage error:", error);
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
      .from("team_coverage_snapshots")
      .select("result, generated_at")
      .eq("manager_id", user.id)
      .single();

    if (!data) return NextResponse.json(null);

    return NextResponse.json({
      ...data.result,
      generated_at: data.generated_at,
    });
  } catch (error) {
    console.error("Team coverage load error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
