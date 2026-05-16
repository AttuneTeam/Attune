import { NextRequest } from "next/server";
import { streamText, tool, stepCountIs, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  extractPlainText,
  formatTeamValues,
  formatOrgContext,
  SUMMARIZE_SYSTEM,
  ACTION_ITEMS_SYSTEM,
  COACHING_SYSTEM,
  MANAGER_READ_SYSTEM,
  COACHING_NUDGES_SYSTEM,
} from "@/lib/ai/prompts";
import { embedInteraction } from "@/lib/ai/embeddings";

const AGENT_SYSTEM = `You are a management assistant AI that processes notes from 1-on-1 meetings between a manager and a direct report.

Given the interaction notes, work through these steps using the available tools:

1. Summarize the interaction — always do this first to understand the content, tone, and sentiment
2. Extract action items — identify specific commitments, tasks, or next steps from the conversation
3. Generate coaching questions — prepare the manager for more effective future conversations
4. Check the member's recent sentiment history — look for patterns across interactions
5. Based on what you find, decide whether escalation is needed

Think out loud as you work. Before each tool call, briefly explain what you are about to do and why. After each result, reflect on what it tells you and what you will do next. When deciding whether to create an escalation reminder, reason through it explicitly — not every negative interaction warrants escalation, but a persistent pattern does.`;

export async function POST(request: NextRequest) {
  const { interactionId } = await request.json();
  if (!interactionId)
    return new Response("interactionId required", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: interaction } = await supabase
    .from("interactions")
    .select(
      `id, raw_json_notes, manager_id, participant_id,
       team_members (id, name, level, role_description, team_id)`,
    )
    .eq("id", interactionId)
    .single();

  if (!interaction || interaction.manager_id !== user.id)
    return new Response("Interaction not found", { status: 404 });

  const notesText = extractPlainText(interaction.raw_json_notes);
  const wordCount = notesText ? notesText.trim().split(/\s+/).length : 0;
  if (!notesText || wordCount < 30)
    return Response.json({ skipped: true, reason: "insufficient_content" });

  const member = (interaction as any).team_members;
  const memberId: string = member?.id ?? "";
  const memberName: string = member?.name ?? "this person";

  // Pre-fetch shared context needed by multiple tools
  const [{ data: teamValues }, { data: orgContext }, { data: pastInteractions }] =
    await Promise.all([
      member?.team_id
        ? supabase
            .from("team_values")
            .select("name, description, keywords")
            .eq("team_id", member.team_id)
        : Promise.resolve({ data: [] }),
      supabase
        .from("org_context")
        .select("*")
        .eq("manager_id", user.id)
        .single(),
      supabase
        .from("interactions")
        .select("ai_summary, scheduled_at")
        .eq("participant_id", memberId)
        .neq("id", interactionId)
        .not("ai_summary", "is", null)
        .order("scheduled_at", { ascending: false })
        .limit(3),
    ]);

  const valuesBlock = formatTeamValues(teamValues ?? []);
  const orgContextBlock = formatOrgContext(orgContext ?? null);

  const result = streamText({
    model: openai("gpt-4o"),
    system: AGENT_SYSTEM,
    prompt: `Process this interaction with ${memberName}.\n\nNotes:\n${notesText}`,
    stopWhen: stepCountIs(8),
    tools: {
      summarize_interaction: tool({
        description:
          "Generate a summary, sentiment score (-1 to 1), and up to 4 key themes from the interaction notes. Always call this first.",
        inputSchema: z.object({}),
        execute: async () => {
          const { object } = await generateObject({
            model: openai("gpt-5.4"),
            system: SUMMARIZE_SYSTEM,
            prompt: [valuesBlock, `Meeting notes:\n\n${notesText}`]
              .filter(Boolean)
              .join("\n\n"),
            schema: z.object({
              summary: z.string(),
              sentiment: z.number().min(-1).max(1),
              keyThemes: z
                .array(z.string())
                .max(4)
                .describe(
                  "Up to 4 key themes. Each must be a single short phrase with no commas.",
                ),
            }),
          });
          await supabase
            .from("interactions")
            .update({
              ai_summary: object.summary,
              sentiment_score: object.sentiment,
              key_themes: object.keyThemes,
            })
            .eq("id", interactionId);
          embedInteraction(interactionId, interaction.raw_json_notes).catch(
            console.error,
          );
          return object;
        },
      }),

      extract_action_items: tool({
        description:
          "Extract specific action items, commitments, or next steps from the meeting notes and save them.",
        inputSchema: z.object({}),
        execute: async () => {
          const { object } = await generateObject({
            model: openai("gpt-5.4-mini"),
            system: ACTION_ITEMS_SYSTEM,
            prompt: [
              `This interaction is with: ${memberName}`,
              `Meeting notes:\n\n${notesText}`,
            ].join("\n\n"),
            schema: z.object({
              items: z.array(
                z.object({
                  description: z.string(),
                  due_date: z.string().nullable(),
                  scope: z
                    .enum(["individual", "manager"])
                    .describe(
                      '"individual" if the action is specific to this person (their task, their growth, their commitment). "manager" if it is something the manager takes away that affects the broader team, company strategy, or multiple people — e.g. process changes, hiring decisions, company initiatives.',
                    ),
                }),
              ),
            }),
          });

          const individual = object.items.filter((i) => i.scope === "individual");
          const manager = object.items.filter((i) => i.scope === "manager");

          if (individual.length > 0) {
            await supabase.from("action_items").insert(
              individual.map((item) => ({
                interaction_id: interactionId,
                description: item.description,
                status: "open" as const,
                due_date: item.due_date ?? null,
              })),
            );
          }

          if (manager.length > 0) {
            await supabase.from("action_items").insert(
              manager.map((item) => ({
                user_id: user.id,
                description: item.description,
                status: "open" as const,
                due_date: item.due_date ?? null,
              })),
            );
          }

          return {
            count: object.items.length,
            individualCount: individual.length,
            managerCount: manager.length,
            items: object.items.map((i) => `[${i.scope}] ${i.description}`),
          };
        },
      }),

      generate_coaching_questions: tool({
        description:
          "Generate 3–5 coaching questions to help the manager have more effective future conversations with this person.",
        inputSchema: z.object({}),
        execute: async () => {
          const contextParts = [
            orgContextBlock,
            valuesBlock,
            `Team member: ${memberName} (${member?.level ?? "unknown level"})`,
            member?.role_description ? `Role: ${member.role_description}` : null,
            `\nCurrent interaction notes:\n${notesText}`,
            pastInteractions && pastInteractions.length > 0
              ? `\nRecent interaction context:\n${(pastInteractions as any[]).map((m, i) => `${i + 1}. ${m.ai_summary ?? "(no summary)"}`).join("\n")}`
              : null,
          ]
            .filter(Boolean)
            .join("\n");
          const { object } = await generateObject({
            model: openai("gpt-4o"),
            system: COACHING_SYSTEM,
            prompt: contextParts,
            schema: z.object({
              questions: z.array(z.string()).min(3).max(5),
            }),
          });
          const questions = object.questions.slice(0, 5);
          await supabase
            .from("interactions")
            .update({ coaching_questions: questions })
            .eq("id", interactionId);
          return { questions };
        },
      }),

      check_sentiment_history: tool({
        description:
          "Retrieve the recent sentiment history for this team member to identify patterns across interactions.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data: recent } = await supabase
            .from("interactions")
            .select("sentiment_score, scheduled_at")
            .eq("participant_id", memberId)
            .not("sentiment_score", "is", null)
            .order("scheduled_at", { ascending: false })
            .limit(6);

          const scores = (recent ?? []).map(
            (r: any) => r.sentiment_score as number,
          );
          let consecutiveNegative = 0;
          for (const score of scores) {
            if (score < -0.2) consecutiveNegative++;
            else break;
          }
          const avg =
            scores.length > 0
              ? scores.reduce((a, b) => a + b, 0) / scores.length
              : null;

          return {
            recentScores: scores,
            consecutiveNegativeCount: consecutiveNegative,
            averageSentiment:
              avg !== null ? parseFloat(avg.toFixed(2)) : null,
            interactionCount: scores.length,
          };
        },
      }),

      create_escalation_reminder: tool({
        description:
          "Create a high-priority reminder in the manager's daily briefing when a concerning sentiment pattern warrants proactive follow-up.",
        inputSchema: z.object({
          reason: z
            .string()
            .describe("Clear explanation of why this escalation is needed"),
          daysUntilDue: z
            .number()
            .min(1)
            .max(14)
            .describe("How many days from now until this should be actioned"),
        }),
        execute: async ({ reason, daysUntilDue }: { reason: string; daysUntilDue: number }) => {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + daysUntilDue);
          await supabase.from("personal_items").insert({
            user_id: user.id,
            type: "reminder",
            content: `Check in with ${memberName} — ${reason}`,
            due_date: dueDate.toISOString(),
            status: "open",
          });
          return {
            created: true,
            dueDate: dueDate.toISOString().slice(0, 10),
          };
        },
      }),
    },

    onFinish: async ({ steps }) => {
      const hasSummarized = steps.some((s) =>
        s.toolCalls?.some((tc: any) => tc.toolName === "summarize_interaction"),
      );
      if (!hasSummarized || !memberId) return;
      // Regenerate manager read + coaching nudges in the background
      (async () => {
        try {
          const { data: recent } = await supabase
            .from("interactions")
            .select("scheduled_at, ai_summary, key_themes, sentiment_score")
            .eq("participant_id", memberId)
            .not("ai_summary", "is", null)
            .order("scheduled_at", { ascending: false })
            .limit(5);
          if (!recent || recent.length === 0) return;

          const lines = (recent as any[])
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

          const { object: readObject } = await generateObject({
            model: openai("gpt-5.4"),
            system: MANAGER_READ_SYSTEM,
            prompt: `Team member: ${memberName}\n\nRecent interaction summaries:\n\n${lines}`,
            schema: z.object({
              bullets: z.array(z.string()).min(3).max(5),
            }),
          });

          await supabase
            .from("team_members")
            .update({
              manager_read: readObject.bullets,
              manager_read_updated_at: new Date().toISOString(),
            })
            .eq("id", memberId);

          const scores = (recent as any[])
            .map((r) => r.sentiment_score)
            .filter((s): s is number => s !== null);
          const r3 = scores.slice(0, 3);
          const p3 = scores.slice(3, 6);
          const rAvg = r3.length
            ? r3.reduce((a, b) => a + b, 0) / r3.length
            : null;
          const pAvg = p3.length
            ? p3.reduce((a, b) => a + b, 0) / p3.length
            : null;
          const trend =
            rAvg !== null && pAvg !== null
              ? rAvg > pAvg + 0.2
                ? "improving"
                : rAvg < pAvg - 0.2
                  ? "declining"
                  : "stable"
              : "unknown";

          const { object: nudgesObject } = await generateObject({
            model: openai("gpt-5.4"),
            system: COACHING_NUDGES_SYSTEM,
            prompt: [
              `Team member: ${memberName}${member?.level ? ` (${member.level})` : ""}`,
              `Manager read:\n${readObject.bullets.map((b: string) => `• ${b}`).join("\n")}`,
              `Sentiment signals:`,
              `- Recent avg: ${rAvg !== null ? rAvg.toFixed(2) : "no data"}`,
              `- Trend: ${trend}`,
            ].join("\n"),
            schema: z.object({
              nudges: z
                .array(
                  z.object({
                    text: z.string(),
                    theme: z.enum([
                      "ask",
                      "check-in",
                      "challenge",
                      "reinforce",
                      "unblock",
                    ]),
                  }),
                )
                .min(2)
                .max(3),
            }),
          });

          await supabase
            .from("team_members")
            .update({
              coaching_nudges: nudgesObject.nudges,
              coaching_nudges_updated_at: new Date().toISOString(),
            })
            .eq("id", memberId);
        } catch (e) {
          console.error("Manager read error:", e);
        }
      })();
    },
  });

  return result.toUIMessageStreamResponse();
}
