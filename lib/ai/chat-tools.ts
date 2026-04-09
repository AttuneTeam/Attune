import { tool, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import OpenAI from "openai";
import { github } from "@/lib/integrations/github";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COACHING_SYSTEM,
  extractPlainText,
  formatTeamValues,
  formatOrgContext,
} from "@/lib/ai/prompts";

const MAX_SEARCH_RESULTS = 5;
const MAX_GITHUB_EVENTS = 10;
const MAX_PROFILE_INTERACTIONS = 5;

export function buildChatTools(supabase: SupabaseClient, userId: string) {
  return {
    list_team_members: tool({
      description:
        "List all team members with their name, level, and role. Call this first when a question names a person to resolve who is being referred to.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from("team_members")
          .select("id, name, level, role_description, start_date, skills")
          .eq("manager_id", userId)
          .order("name");

        if (error) return { error: error.message };
        return { members: data ?? [] };
      },
    }),

    search_interactions: tool({
      description:
        "Semantically search interaction (1-on-1 meeting) history. Use this to find discussions about specific topics, themes, or concerns. Only interactions that have been summarised are searchable.",
      inputSchema: z.object({
        query: z.string().describe("The topic or question to search for"),
        member_name: z
          .string()
          .optional()
          .describe(
            "Filter results to a specific team member (partial name match)",
          ),
        date_from: z
          .string()
          .optional()
          .describe(
            "ISO date string — only include interactions on or after this date",
          ),
        date_to: z
          .string()
          .optional()
          .describe(
            "ISO date string — only include interactions on or before this date",
          ),
      }),
      execute: async ({ query, member_name, date_from, date_to }) => {
        const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const embeddingRes = await openaiClient.embeddings.create({
          model: "text-embedding-ada-002",
          input: query.trim(),
        });
        const queryEmbedding = embeddingRes.data[0].embedding;

        const { data: results, error } = await supabase.rpc("match_documents", {
          query_embedding: queryEmbedding,
          match_threshold: 0.65,
          match_count: MAX_SEARCH_RESULTS + 5, // fetch extra so we can filter
        });

        if (error) return { error: error.message };

        let filtered = results ?? [];

        if (member_name) {
          const lower = member_name.toLowerCase();
          filtered = filtered.filter((r: { participant_name: string }) =>
            r.participant_name?.toLowerCase().includes(lower),
          );
        }

        if (date_from) {
          filtered = filtered.filter(
            (r: { scheduled_at: string }) => r.scheduled_at >= date_from,
          );
        }

        if (date_to) {
          filtered = filtered.filter(
            (r: { scheduled_at: string }) => r.scheduled_at <= date_to,
          );
        }

        return { results: filtered.slice(0, MAX_SEARCH_RESULTS) };
      },
    }),

    get_member_profile: tool({
      description:
        "Get a full profile for a team member: recent interaction summaries, sentiment trend, open action items, and current goals. Use this when asked how someone is doing.",
      inputSchema: z.object({
        member_name: z
          .string()
          .describe("Name (or partial name) of the team member"),
      }),
      execute: async ({ member_name }) => {
        const { data: members } = await supabase
          .from("team_members")
          .select(
            "id, name, level, role_description, start_date, skills, team_id",
          )
          .eq("manager_id", userId)
          .ilike("name", `%${member_name}%`)
          .limit(1);

        const member = members?.[0];
        if (!member)
          return { error: `No team member found matching "${member_name}"` };

        const [{ data: interactions }, { data: actionItems }, { data: goals }] =
          await Promise.all([
            supabase
              .from("interactions")
              .select(
                "id, scheduled_at, ai_summary, sentiment_score, key_themes, type",
              )
              .eq("participant_id", member.id)
              .eq("manager_id", userId)
              .order("scheduled_at", { ascending: false })
              .limit(MAX_PROFILE_INTERACTIONS + 3), // extra for sentiment trend
            supabase
              .from("action_items")
              .select("description, status, due_date, interaction_id")
              .in(
                "interaction_id",
                await supabase
                  .from("interactions")
                  .select("id")
                  .eq("participant_id", member.id)
                  .eq("manager_id", userId)
                  .then(({ data }) => (data ?? []).map((r) => r.id)),
              )
              .in("status", ["open", "in_progress"])
              .order("due_date", { ascending: true }),
            supabase
              .from("member_goals")
              .select("title, status, period_type, year, period")
              .eq("member_id", member.id)
              .eq("manager_id", userId)
              .order("year", { ascending: false })
              .limit(5),
          ]);

        const recentInteractions = (interactions ?? []).slice(
          0,
          MAX_PROFILE_INTERACTIONS,
        );
        const sentimentTrend = (interactions ?? []).map((i) => ({
          date: i.scheduled_at,
          score: i.sentiment_score,
        }));

        return {
          member: {
            name: member.name,
            level: member.level,
            role_description: member.role_description,
            start_date: member.start_date,
            skills: member.skills,
          },
          recent_interactions: recentInteractions.map((i) => ({
            date: i.scheduled_at,
            summary: i.ai_summary,
            sentiment: i.sentiment_score,
            themes: i.key_themes,
            type: i.type,
          })),
          sentiment_trend: sentimentTrend,
          open_action_items: actionItems ?? [],
          goals: goals ?? [],
        };
      },
    }),

    get_action_items: tool({
      description:
        "List open or in-progress action items. Optionally filter by team member or due date.",
      inputSchema: z.object({
        member_name: z
          .string()
          .optional()
          .describe("Filter to a specific team member (partial name match)"),
        status: z
          .enum(["open", "in_progress", "done"])
          .optional()
          .describe("Filter by status (defaults to open and in_progress)"),
        due_before: z
          .string()
          .optional()
          .describe("ISO date — only include items due on or before this date"),
      }),
      execute: async ({ member_name, status, due_before }) => {
        // Build interaction IDs query scoped to this manager
        let interactionQuery = supabase
          .from("interactions")
          .select("id, participant_id, scheduled_at, team_members!inner(name)")
          .eq("manager_id", userId);

        if (member_name) {
          interactionQuery = interactionQuery.ilike(
            "team_members.name" as any,
            `%${member_name}%`,
          );
        }

        const { data: interactions } = await interactionQuery;

        if (!interactions || interactions.length === 0) {
          return { action_items: [] };
        }

        const interactionMap: Record<string, string> = {};
        for (const i of interactions) {
          interactionMap[i.id] = (i as any).team_members?.name ?? "Unknown";
        }

        let itemQuery = supabase
          .from("action_items")
          .select("id, description, status, due_date, interaction_id")
          .in("interaction_id", Object.keys(interactionMap));

        if (status) {
          itemQuery = itemQuery.eq("status", status);
        } else {
          itemQuery = itemQuery.in("status", ["open", "in_progress"]);
        }

        if (due_before) {
          itemQuery = itemQuery.lte("due_date", due_before);
        }

        const { data: items, error } = await itemQuery.order("due_date", {
          ascending: true,
          nullsFirst: false,
        });

        if (error) return { error: error.message };

        return {
          action_items: (items ?? []).map((item) => ({
            description: item.description,
            status: item.status,
            due_date: item.due_date,
            member_name: interactionMap[item.interaction_id] ?? "Unknown",
          })),
        };
      },
    }),

    get_github_activity: tool({
      description:
        "Fetch recent GitHub pull requests and activity for a team member who has a GitHub integration configured.",
      inputSchema: z.object({
        member_name: z
          .string()
          .describe("Name (or partial name) of the team member"),
      }),
      execute: async ({ member_name }) => {
        const { data: members } = await supabase
          .from("team_members")
          .select("id, name")
          .eq("manager_id", userId)
          .ilike("name", `%${member_name}%`)
          .limit(1);

        const member = members?.[0];
        if (!member)
          return { error: `No team member found matching "${member_name}"` };

        const { data: integrations } = await supabase
          .from("team_member_integrations")
          .select("handle, config")
          .eq("member_id", member.id)
          .eq("provider", "github")
          .limit(1);

        const integration = integrations?.[0];
        if (!integration) {
          return {
            error: `No GitHub integration configured for ${member.name}. The manager needs to add it in the team member's profile.`,
          };
        }

        try {
          const items = await github.fetch(
            integration.handle,
            integration.config,
          );
          return {
            member_name: member.name,
            github_handle: integration.handle,
            activity: items.slice(0, MAX_GITHUB_EVENTS),
          };
        } catch {
          return {
            error: `Failed to fetch GitHub activity for ${member.name}`,
          };
        }
      },
    }),

    get_team_coverage: tool({
      description:
        "Get the latest team coverage analysis: strengths, capability gaps, single points of failure, and overlap risks across the team.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from("team_coverage_snapshots")
          .select("result, generated_at")
          .eq("manager_id", userId)
          .order("generated_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          return {
            error:
              "No team coverage analysis found. Run the analysis from the Roles page first.",
          };
        }

        return {
          generated_at: data.generated_at,
          coverage: data.result,
        };
      },
    }),

    generate_coaching_questions: tool({
      description:
        "Generate 3-5 thoughtful coaching questions to prepare for a 1-on-1 with a team member. Uses their recent interaction history as context.",
      inputSchema: z.object({
        member_name: z
          .string()
          .describe("Name (or partial name) of the team member"),
      }),
      execute: async ({ member_name }) => {
        const { data: members } = await supabase
          .from("team_members")
          .select("id, name, level, role_description, team_id")
          .eq("manager_id", userId)
          .ilike("name", `%${member_name}%`)
          .limit(1);

        const member = members?.[0];
        if (!member)
          return { error: `No team member found matching "${member_name}"` };

        const [
          { data: interactions },
          { data: teamValues },
          { data: orgContext },
        ] = await Promise.all([
          supabase
            .from("interactions")
            .select("raw_json_notes, ai_summary, scheduled_at")
            .eq("participant_id", member.id)
            .eq("manager_id", userId)
            .order("scheduled_at", { ascending: false })
            .limit(4),
          member.team_id
            ? supabase
                .from("team_values")
                .select("name, description, keywords")
                .eq("team_id", member.team_id)
            : Promise.resolve({ data: [] }),
          supabase
            .from("org_context")
            .select("*")
            .eq("manager_id", userId)
            .single(),
        ]);

        const [latest, ...past] = interactions ?? [];
        const notesText = latest ? extractPlainText(latest.raw_json_notes) : "";

        const contextParts = [
          formatOrgContext(orgContext ?? null),
          formatTeamValues(teamValues ?? []),
          `Team member: ${member.name} (${member.level ?? "unknown level"})`,
          member.role_description ? `Role: ${member.role_description}` : null,
          notesText ? `\nMost recent interaction notes:\n${notesText}` : null,
          latest?.ai_summary ? `\nSummary: ${latest.ai_summary}` : null,
          past.length
            ? `\nPrevious interactions:\n${past
                .map((p, i) => `${i + 1}. ${p.ai_summary ?? "(no summary)"}`)
                .join("\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

        const { object } = await generateObject({
          model: openai("gpt-4o"),
          system: COACHING_SYSTEM,
          prompt: contextParts,
          schema: z.object({
            questions: z
              .array(z.string())
              .min(3)
              .max(5)
              .describe("Coaching questions for the manager to ask"),
          }),
        });

        return { member_name: member.name, questions: object.questions };
      },
    }),

    create_action_item: tool({
      description:
        "Create an action item (task) for a team member. The action item is attached to their most recent interaction. If no interactions exist yet, a note interaction is created automatically to hold it.",
      inputSchema: z.object({
        member_name: z
          .string()
          .describe("Name (or partial name) of the team member"),
        description: z.string().describe("What needs to be done"),
        due_date: z
          .string()
          .optional()
          .describe("ISO date (YYYY-MM-DD) when this should be done by"),
      }),
      execute: async ({ member_name, description, due_date }) => {
        const { data: members } = await supabase
          .from("team_members")
          .select("id, name")
          .eq("manager_id", userId)
          .ilike("name", `%${member_name}%`)
          .limit(1);

        const member = members?.[0];
        if (!member)
          return { error: `No team member found matching "${member_name}"` };

        // Find the most recent interaction with this person
        let interactionId: string | undefined;
        const { data: latestInteraction } = await supabase
          .from("interactions")
          .select("id")
          .eq("participant_id", member.id)
          .eq("manager_id", userId)
          .order("scheduled_at", { ascending: false })
          .limit(1)
          .single();

        if (latestInteraction) {
          interactionId = latestInteraction.id;
        } else {
          // No interactions yet — create a lightweight note to hold the action item
          const { data: newInteraction, error: interactionError } =
            await supabase
              .from("interactions")
              .insert({
                participant_id: member.id,
                manager_id: userId,
                type: "note",
                title: "Action items",
                status: "completed",
              })
              .select("id")
              .single();

          if (interactionError || !newInteraction) {
            return {
              error: `Could not create action item: ${interactionError?.message ?? "unknown error"}`,
            };
          }
          interactionId = newInteraction.id;
        }

        const { data: actionItem, error } = await supabase
          .from("action_items")
          .insert({
            interaction_id: interactionId,
            description,
            status: "open",
            ...(due_date ? { due_date } : {}),
          })
          .select("id, description, status, due_date")
          .single();

        if (error) return { error: error.message };

        return {
          created: true,
          member_name: member.name,
          action_item: {
            description: actionItem.description,
            status: actionItem.status,
            due_date: actionItem.due_date,
          },
        };
      },
    }),

    schedule_followup: tool({
      description:
        "Schedule a follow-up meeting or create a note for a team member. Use this when the manager wants to set up a 1-on-1 check-in or log a reminder to meet.",
      inputSchema: z.object({
        member_name: z
          .string()
          .describe("Name (or partial name) of the team member"),
        title: z
          .string()
          .optional()
          .describe(
            'Title for the meeting (e.g. "1-on-1", "Career growth check-in"). Defaults to "1-on-1".',
          ),
        type: z
          .enum(["scheduled", "incidental", "note"])
          .optional()
          .describe(
            'Interaction type. Use "scheduled" for a planned meeting, "incidental" for an ad-hoc chat, "note" for a reminder. Defaults to "scheduled".',
          ),
        date: z
          .string()
          .optional()
          .describe(
            "ISO date (YYYY-MM-DD) for when the meeting should happen. Defaults to today.",
          ),
      }),
      execute: async ({ member_name, title, type, date }) => {
        const { data: members } = await supabase
          .from("team_members")
          .select("id, name")
          .eq("manager_id", userId)
          .ilike("name", `%${member_name}%`)
          .limit(1);

        const member = members?.[0];
        if (!member)
          return { error: `No team member found matching "${member_name}"` };

        const scheduledAt = date
          ? new Date(date).toISOString()
          : new Date().toISOString();

        const { data: interaction, error } = await supabase
          .from("interactions")
          .insert({
            participant_id: member.id,
            manager_id: userId,
            title: title ?? "1-on-1",
            type: type ?? "scheduled",
            status: "upcoming",
            scheduled_at: scheduledAt,
          })
          .select("id, title, type, scheduled_at")
          .single();

        if (error) return { error: error.message };

        return {
          created: true,
          member_name: member.name,
          interaction: {
            id: interaction.id,
            title: interaction.title,
            type: interaction.type,
            scheduled_at: interaction.scheduled_at,
          },
        };
      },
    }),

    search_knowledge: tool({
      description:
        "Search the manager's uploaded reference documents: career ladders, performance frameworks, engineering principles, company strategy, handbooks. Use when asked about policies, best practices, or frameworks. If results are empty or the note says no documents were found, call web_search next with the same query.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("What to look up in the knowledge base"),
      }),
      execute: async ({ query }) => {
        const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const embeddingRes = await openaiClient.embeddings.create({
          model: "text-embedding-ada-002",
          input: query.trim(),
        });
        const queryEmbedding = embeddingRes.data[0].embedding;

        const { data: results, error } = await supabase.rpc("match_knowledge", {
          query_embedding: queryEmbedding,
          match_threshold: 0.65,
          match_count: 5,
        });

        if (error) return { error: error.message };
        if (!results || results.length === 0) {
          return {
            results: [],
            note: "No relevant documents found. The manager may not have uploaded knowledge documents yet — they can add them under Settings → Knowledge.",
          };
        }

        return { results };
      },
    }),

    web_search: tool({
      description:
        "Search the web for current information: salary benchmarks, engineering management frameworks, industry trends, tool comparisons, or anything not in the team's internal data.",
      inputSchema: z.object({
        query: z.string().describe("What to search for"),
      }),
      execute: async ({ query }) => {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          return {
            error:
              "Web search is not configured. Add TAVILY_API_KEY to your environment variables.",
          };
        }

        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: 5,
            include_answer: true,
            search_depth: "basic",
          }),
        });

        if (!res.ok) {
          return { error: `Web search failed: HTTP ${res.status}` };
        }

        const data = await res.json();
        return {
          answer: data.answer ?? null,
          results: (data.results ?? []).map(
            (r: { title: string; url: string; content: string }) => ({
              title: r.title,
              url: r.url,
              snippet: r.content?.slice(0, 400),
            })
          ),
        };
      },
    }),
  };
}
