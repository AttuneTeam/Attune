import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  extractPlainText,
  formatTeamValues,
  SUMMARIZE_SYSTEM,
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
          .describe("Up to 4 key themes or topics discussed. Each theme must be a single short phrase with no commas — do not combine multiple themes into one item."),
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
