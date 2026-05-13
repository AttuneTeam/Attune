import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  extractPlainText,
  formatTeamValues,
  SUMMARIZE_SYSTEM,
  MANAGER_READ_SYSTEM,
  COACHING_NUDGES_SYSTEM,
} from "@/lib/ai/prompts";
import { embedInteraction } from "@/lib/ai/embeddings";

export async function POST(request: NextRequest) {
  try {
    const { interactionId } = await request.json();
    if (!interactionId)
      return NextResponse.json(
        { error: "interactionId required" },
        { status: 400 },
      );

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: interaction } = await supabase
      .from("interactions")
      .select("id, raw_json_notes, manager_id, participant_id")
      .eq("id", interactionId)
      .single();

    if (!interaction || interaction.manager_id !== user.id) {
      return NextResponse.json(
        { error: "Interaction not found" },
        { status: 404 },
      );
    }

    const notesText = extractPlainText(interaction.raw_json_notes);
    if (!notesText || notesText.length < 20) {
      return NextResponse.json(
        { error: "Notes too short to summarize" },
        { status: 400 },
      );
    }

    // Fetch team values for grounding context
    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("id", interaction.participant_id)
      .single();
    const { data: teamValues } = member?.team_id
      ? await supabase
          .from("team_values")
          .select("name, description, keywords")
          .eq("team_id", member.team_id)
      : { data: [] };
    const valuesBlock = formatTeamValues(teamValues ?? []);

    const { object } = await generateObject({
      model: openai("gpt-5.4"),
      system: SUMMARIZE_SYSTEM,
      prompt: [valuesBlock, `Meeting notes:\n\n${notesText}`]
        .filter(Boolean)
        .join("\n\n"),
      schema: z.object({
        summary: z
          .string()
          .describe("A concise 2-4 sentence summary of the meeting"),
        sentiment: z
          .number()
          .min(-1)
          .max(1)
          .describe("Overall sentiment score from -1 to 1"),
        keyThemes: z
          .array(z.string())
          .max(4)
          .describe(
            "Up to 4 key themes or topics discussed. Each theme must be a single short phrase with no commas — do not combine multiple themes into one item.",
          ),
      }),
    });

    // Update interaction row
    await supabase
      .from("interactions")
      .update({
        ai_summary: object.summary,
        sentiment_score: object.sentiment,
        key_themes: object.keyThemes,
      })
      .eq("id", interactionId);

    // Trigger embedding pipeline asynchronously (don't await — fire & forget)
    embedInteraction(interactionId, interaction.raw_json_notes).catch(
      console.error,
    );

    // Regenerate manager read for this member (fire & forget)
    (async () => {
      try {
        const { data: recent } = await supabase
          .from("interactions")
          .select("scheduled_at, ai_summary, key_themes, sentiment_score")
          .eq("participant_id", interaction.participant_id)
          .not("ai_summary", "is", null)
          .order("scheduled_at", { ascending: false })
          .limit(5);

        if (!recent || recent.length === 0) return;

        const { data: memberInfo } = await supabase
          .from("team_members")
          .select("name, level")
          .eq("id", interaction.participant_id)
          .single();

        const lines = recent
          .map((r, i) => {
            const date = r.scheduled_at.slice(0, 10);
            const themes = (r.key_themes ?? []).join(", ");
            const score =
              r.sentiment_score !== null
                ? ` (sentiment: ${r.sentiment_score.toFixed(2)})`
                : "";
            return `[${i + 1}] ${date}${score}: ${r.ai_summary}${themes ? `\nThemes: ${themes}` : ""}`;
          })
          .join("\n\n");

        const readPrompt = `Team member: ${memberInfo?.name ?? "Unknown"}\n\nRecent interaction summaries:\n\n${lines}`;

        const { object: readObject } = await generateObject({
          model: openai("gpt-5.4"),
          system: MANAGER_READ_SYSTEM,
          prompt: readPrompt,
          schema: z.object({
            bullets: z
              .array(z.string())
              .min(3)
              .max(5)
              .describe(
                "4–5 concise bullet points about this person right now",
              ),
          }),
        });

        await supabase
          .from("team_members")
          .update({
            manager_read: readObject.bullets,
            manager_read_updated_at: new Date().toISOString(),
          })
          .eq("id", interaction.participant_id);

        // Generate coaching nudges from the manager read + sentiment signals
        const scores = recent
          .map((r) => r.sentiment_score)
          .filter((s): s is number => s !== null);
        const recentScores = scores.slice(0, 3);
        const priorScores = scores.slice(3, 6);
        const recentAvg =
          recentScores.length > 0
            ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
            : null;
        const priorAvg =
          priorScores.length > 0
            ? priorScores.reduce((a, b) => a + b, 0) / priorScores.length
            : null;
        const trend =
          recentAvg !== null && priorAvg !== null
            ? recentAvg > priorAvg + 0.2
              ? "improving"
              : recentAvg < priorAvg - 0.2
                ? "declining"
                : "stable"
            : "unknown";
        const daysSinceLastMeeting =
          recent[0]?.scheduled_at
            ? Math.floor(
                (Date.now() - new Date(recent[0].scheduled_at).getTime()) /
                  86400000,
              )
            : null;

        const nudgesPrompt = [
          `Team member: ${memberInfo?.name ?? "Unknown"}${memberInfo?.level ? ` (${memberInfo.level})` : ""}`,
          `Manager read:\n${readObject.bullets.map((b) => `• ${b}`).join("\n")}`,
          `Sentiment signals:`,
          `- Recent avg: ${recentAvg !== null ? recentAvg.toFixed(2) : "no data"}`,
          `- Trend: ${trend}`,
          daysSinceLastMeeting !== null
            ? `- Days since last interaction: ${daysSinceLastMeeting}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

        const { object: nudgesObject } = await generateObject({
          model: openai("gpt-5.4"),
          system: COACHING_NUDGES_SYSTEM,
          prompt: nudgesPrompt,
          schema: z.object({
            nudges: z
              .array(
                z.object({
                  text: z.string().describe("The coaching nudge text"),
                  theme: z
                    .enum(["ask", "check-in", "challenge", "reinforce", "unblock"])
                    .describe("The nudge theme"),
                }),
              )
              .min(2)
              .max(3)
              .describe("2–3 specific coaching nudges"),
          }),
        });

        await supabase
          .from("team_members")
          .update({
            coaching_nudges: nudgesObject.nudges,
            coaching_nudges_updated_at: new Date().toISOString(),
          })
          .eq("id", interaction.participant_id);
      } catch (e) {
        console.error("Manager read error:", e);
      }
    })();

    return NextResponse.json({
      summary: object.summary,
      sentiment: object.sentiment,
      keyThemes: object.keyThemes,
    });
  } catch (error) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
