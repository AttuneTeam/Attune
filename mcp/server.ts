#!/usr/bin/env node
/**
 * TeamLeader MCP Server
 *
 * Exposes your TeamLeader meeting data to Claude Desktop / Claude Code as MCP tools.
 *
 * Required env vars (can live in the same .env.local as the Next.js app):
 *   NEXT_PUBLIC_SUPABASE_URL      — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key (bypasses RLS; manager_id scopes every query)
 *   OPENAI_API_KEY                — for embedding-based search
 *   MCP_MANAGER_ID                — your Supabase auth user ID (profiles.id)
 *
 * Optional:
 *   GITHUB_TOKEN                  — enables get_github_activity
 *   TAVILY_API_KEY                — enables web_search
 *
 * Run:
 *   npx tsx mcp/server.ts
 *
 * Claude Desktop config (~/.config/claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "teamleader": {
 *         "command": "npx",
 *         "args": ["tsx", "/absolute/path/to/teamleader/mcp/server.ts"],
 *         "env": {
 *           "NEXT_PUBLIC_SUPABASE_URL": "...",
 *           "SUPABASE_SERVICE_ROLE_KEY": "...",
 *           "OPENAI_API_KEY": "...",
 *           "MCP_MANAGER_ID": "..."
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const managerId = process.env.MCP_MANAGER_ID

if (!supabaseUrl || !serviceRoleKey || !managerId) {
  process.stderr.write(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MCP_MANAGER_ID\n",
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function embedQuery(query: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: query.trim(),
  })
  return res.data[0].embedding
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "teamleader", version: "1.0.0" })

// ---------------------------------------------------------------------------
// Tool: list_team_members
// ---------------------------------------------------------------------------
server.tool(
  "list_team_members",
  "List all team members with their name, level, and role. Call this first when a question names a person to resolve who is being referred to.",
  {},
  async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("id, name, level, role_description, start_date, skills")
      .eq("manager_id", managerId)
      .order("name")

    if (error) return err(error.message)
    return ok(data ?? [])
  },
)

// ---------------------------------------------------------------------------
// Tool: search_interactions
// ---------------------------------------------------------------------------
server.tool(
  "search_interactions",
  "Semantically search 1-on-1 meeting history by topic. Only interactions that have been summarised are searchable. Returns relevant excerpts with participant name and date.",
  {
    query: z.string().describe("The topic or question to search for"),
    member_name: z.string().optional().describe("Filter results to a specific team member"),
    date_from: z.string().optional().describe("ISO date — include interactions on or after this date"),
    date_to: z.string().optional().describe("ISO date — include interactions on or before this date"),
  },
  async ({ query, member_name, date_from, date_to }) => {
    const queryEmbedding = await embedQuery(query)

    const { data: results, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.65,
      match_count: 10,
    })

    if (error) return err(error.message)

    let filtered: Array<{ participant_name: string; scheduled_at: string }> = results ?? []

    if (member_name) {
      const lower = member_name.toLowerCase()
      filtered = filtered.filter((r) => r.participant_name?.toLowerCase().includes(lower))
    }
    if (date_from) filtered = filtered.filter((r) => r.scheduled_at >= date_from)
    if (date_to) filtered = filtered.filter((r) => r.scheduled_at <= date_to)

    return ok(filtered.slice(0, 5))
  },
)

// ---------------------------------------------------------------------------
// Tool: get_member_profile
// ---------------------------------------------------------------------------
server.tool(
  "get_member_profile",
  "Get a full profile for a team member: recent interaction summaries, sentiment trend, open action items, and current goals.",
  {
    member_name: z.string().describe("Name (or partial name) of the team member"),
  },
  async ({ member_name }) => {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name, level, role_description, start_date, skills")
      .eq("manager_id", managerId)
      .ilike("name", `%${member_name}%`)
      .limit(1)

    const member = members?.[0]
    if (!member) return err(`No team member found matching "${member_name}"`)

    const [{ data: interactions }, { data: actionItems }, { data: goals }] = await Promise.all([
      supabase
        .from("interactions")
        .select("id, scheduled_at, ai_summary, sentiment_score, key_themes, type")
        .eq("participant_id", member.id)
        .eq("manager_id", managerId)
        .order("scheduled_at", { ascending: false })
        .limit(8),
      supabase
        .from("action_items")
        .select("description, status, due_date, interaction_id, interactions!inner(participant_id)")
        .eq("interactions.participant_id" as never, member.id)
        .in("status", ["open", "in_progress"])
        .order("due_date", { ascending: true }),
      supabase
        .from("member_goals")
        .select("title, status, period_type, year, period")
        .eq("member_id", member.id)
        .eq("manager_id", managerId)
        .order("year", { ascending: false })
        .limit(5),
    ])

    const recentInteractions = (interactions ?? []).slice(0, 5)
    const sentimentTrend = (interactions ?? []).map((i) => ({
      date: i.scheduled_at,
      score: i.sentiment_score,
    }))

    return ok({
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
    })
  },
)

// ---------------------------------------------------------------------------
// Tool: get_member_persona
// ---------------------------------------------------------------------------
server.tool(
  "get_member_persona",
  "Get the synthesised persona (working-style profile) for a team member: how they communicate, what motivates them, their stress signature, feedback that lands, growth edge, and open threads. Each claim is evidence-anchored (cited to interactions) with a confidence level and observation/inference tag. Built by folding Processed interactions; may not exist until interactions are Processed or a backfill is run.",
  {
    member_name: z.string().describe("Name (or partial name) of the team member"),
  },
  async ({ member_name }) => {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("manager_id", managerId)
      .ilike("name", `%${member_name}%`)
      .limit(1)

    const member = members?.[0]
    if (!member) return err(`No team member found matching "${member_name}"`)

    const { data: persona } = await supabase
      .from("member_personas")
      .select("content, version, source_counts, updated_at")
      .eq("member_id", member.id)
      .maybeSingle()

    if (!persona) {
      return ok({
        member_name: member.name,
        persona: null,
        note: `No persona has been built for ${member.name} yet. It is created when interactions are Processed, or via a one-time backfill from their profile page.`,
      })
    }

    return ok({
      member_name: member.name,
      version: persona.version,
      updated_at: persona.updated_at,
      source_counts: persona.source_counts,
      persona: persona.content,
    })
  },
)

// ---------------------------------------------------------------------------
// Tool: get_action_items
// ---------------------------------------------------------------------------
server.tool(
  "get_action_items",
  "List open or in-progress action items across the team. Optionally filter by member, status, or due date.",
  {
    member_name: z.string().optional().describe("Filter to a specific team member"),
    status: z
      .enum(["open", "in_progress", "done"])
      .optional()
      .describe("Filter by status (defaults to open and in_progress)"),
    due_before: z.string().optional().describe("ISO date — only items due on or before this date"),
  },
  async ({ member_name, status, due_before }) => {
    let interactionQuery = supabase
      .from("interactions")
      .select("id, participant_id, team_members!inner(name)")
      .eq("manager_id", managerId)

    if (member_name) {
      interactionQuery = interactionQuery.ilike("team_members.name" as never, `%${member_name}%`)
    }

    const { data: interactions } = await interactionQuery

    if (!interactions || interactions.length === 0) return ok({ action_items: [] })

    const interactionMap: Record<string, string> = {}
    for (const i of interactions) {
      interactionMap[i.id] = (i as { team_members?: { name?: string } }).team_members?.name ?? "Unknown"
    }

    let itemQuery = supabase
      .from("action_items")
      .select("id, description, status, due_date, interaction_id")
      .in("interaction_id", Object.keys(interactionMap))

    if (status) {
      itemQuery = itemQuery.eq("status", status)
    } else {
      itemQuery = itemQuery.in("status", ["open", "in_progress"])
    }
    if (due_before) itemQuery = itemQuery.lte("due_date", due_before)

    const { data: items, error } = await itemQuery.order("due_date", {
      ascending: true,
      nullsFirst: false,
    })

    if (error) return err(error.message)

    return ok({
      action_items: (items ?? []).map((item) => ({
        description: item.description,
        status: item.status,
        due_date: item.due_date,
        member_name: interactionMap[item.interaction_id] ?? "Unknown",
      })),
    })
  },
)

// ---------------------------------------------------------------------------
// Tool: get_team_coverage
// ---------------------------------------------------------------------------
server.tool(
  "get_team_coverage",
  "Get the latest team coverage analysis: capability strengths, gaps, single points of failure, and overlap risks.",
  {},
  async () => {
    const { data, error } = await supabase
      .from("team_coverage_snapshots")
      .select("result, generated_at")
      .eq("manager_id", managerId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return err("No team coverage analysis found. Run the analysis from the Roles page first.")
    }

    return ok({ generated_at: data.generated_at, coverage: data.result })
  },
)

// ---------------------------------------------------------------------------
// Tool: generate_coaching_questions
// ---------------------------------------------------------------------------
server.tool(
  "generate_coaching_questions",
  "Generate 3-5 thoughtful coaching questions to prepare for a 1-on-1 with a team member. Uses their recent interaction history as context.",
  {
    member_name: z.string().describe("Name (or partial name) of the team member"),
  },
  async ({ member_name }) => {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name, level, role_description")
      .eq("manager_id", managerId)
      .ilike("name", `%${member_name}%`)
      .limit(1)

    const member = members?.[0]
    if (!member) return err(`No team member found matching "${member_name}"`)

    const { data: interactions } = await supabase
      .from("interactions")
      .select("ai_summary, scheduled_at")
      .eq("participant_id", member.id)
      .eq("manager_id", managerId)
      .not("ai_summary", "is", null)
      .order("scheduled_at", { ascending: false })
      .limit(4)

    const contextParts = [
      `Team member: ${member.name} (${member.level ?? "unknown level"})`,
      member.role_description ? `Role: ${member.role_description}` : null,
      interactions?.length
        ? `Recent interactions:\n${interactions
            .map((i, n) => `${n + 1}. ${i.scheduled_at.slice(0, 10)}: ${i.ai_summary}`)
            .join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n")

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert manager coach. Given context about a team member, suggest 3-5 thoughtful coaching questions for the manager's next 1-on-1. Be specific to the context, not generic. Return JSON: { \"questions\": [\"...\"] }",
        },
        { role: "user", content: contextParts },
      ],
    })

    const raw = response.choices[0].message.content ?? "{}"
    const parsed = JSON.parse(raw) as { questions?: string[] }
    return ok({ member_name: member.name, questions: parsed.questions ?? [] })
  },
)

// ---------------------------------------------------------------------------
// Tool: create_action_item
// ---------------------------------------------------------------------------
server.tool(
  "create_action_item",
  "Create an action item for a team member, attached to their most recent interaction.",
  {
    member_name: z.string().describe("Name (or partial name) of the team member"),
    description: z.string().describe("What needs to be done"),
    due_date: z.string().optional().describe("ISO date (YYYY-MM-DD) when this should be done by"),
  },
  async ({ member_name, description, due_date }) => {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("manager_id", managerId)
      .ilike("name", `%${member_name}%`)
      .limit(1)

    const member = members?.[0]
    if (!member) return err(`No team member found matching "${member_name}"`)

    let interactionId: string | undefined

    const { data: latestInteraction } = await supabase
      .from("interactions")
      .select("id")
      .eq("participant_id", member.id)
      .eq("manager_id", managerId)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .single()

    if (latestInteraction) {
      interactionId = latestInteraction.id
    } else {
      const { data: newInteraction, error: interactionError } = await supabase
        .from("interactions")
        .insert({
          participant_id: member.id,
          manager_id: managerId,
          type: "note",
          title: "Action items",
          status: "completed",
        })
        .select("id")
        .single()

      if (interactionError || !newInteraction) {
        return err(interactionError?.message ?? "Could not create holding interaction")
      }
      interactionId = newInteraction.id
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
      .single()

    if (error) return err(error.message)

    return ok({ created: true, member_name: member.name, action_item: actionItem })
  },
)

// ---------------------------------------------------------------------------
// Tool: schedule_followup
// ---------------------------------------------------------------------------
server.tool(
  "schedule_followup",
  'Create a follow-up meeting or note for a team member. Use "scheduled" for a planned 1-on-1, "note" for a reminder.',
  {
    member_name: z.string().describe("Name (or partial name) of the team member"),
    title: z.string().optional().describe('Title for the meeting. Defaults to "1-on-1".'),
    type: z
      .enum(["scheduled", "incidental", "note"])
      .optional()
      .describe('Interaction type. Defaults to "scheduled".'),
    date: z.string().optional().describe("ISO date (YYYY-MM-DD). Defaults to today."),
  },
  async ({ member_name, title, type, date }) => {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("manager_id", managerId)
      .ilike("name", `%${member_name}%`)
      .limit(1)

    const member = members?.[0]
    if (!member) return err(`No team member found matching "${member_name}"`)

    const scheduledAt = date ? new Date(date).toISOString() : new Date().toISOString()

    const { data: interaction, error } = await supabase
      .from("interactions")
      .insert({
        participant_id: member.id,
        manager_id: managerId,
        title: title ?? "1-on-1",
        type: type ?? "scheduled",
        status: "upcoming",
        scheduled_at: scheduledAt,
      })
      .select("id, title, type, scheduled_at")
      .single()

    if (error) return err(error.message)

    return ok({ created: true, member_name: member.name, interaction })
  },
)

// ---------------------------------------------------------------------------
// Tool: search_knowledge
// ---------------------------------------------------------------------------
server.tool(
  "search_knowledge",
  "Search uploaded reference documents: career ladders, performance frameworks, team principles, company handbooks.",
  {
    query: z.string().describe("What to look up in the knowledge base"),
  },
  async ({ query }) => {
    const queryEmbedding = await embedQuery(query)

    const { data: results, error } = await supabase.rpc("match_knowledge", {
      query_embedding: queryEmbedding,
      match_threshold: 0.65,
      match_count: 5,
    })

    if (error) return err(error.message)

    if (!results || results.length === 0) {
      return ok({
        results: [],
        note: "No relevant documents found. Upload knowledge documents under Settings → Knowledge.",
      })
    }

    return ok({ results })
  },
)

// ---------------------------------------------------------------------------
// Tool: get_github_activity
// ---------------------------------------------------------------------------
server.tool(
  "get_github_activity",
  "Fetch recent GitHub pull requests for a team member who has a GitHub integration configured.",
  {
    member_name: z.string().describe("Name (or partial name) of the team member"),
  },
  async ({ member_name }) => {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("manager_id", managerId)
      .ilike("name", `%${member_name}%`)
      .limit(1)

    const member = members?.[0]
    if (!member) return err(`No team member found matching "${member_name}"`)

    const { data: integrations } = await supabase
      .from("team_member_integrations")
      .select("handle, config")
      .eq("member_id", member.id)
      .eq("provider", "github")
      .limit(1)

    const integration = integrations?.[0]
    if (!integration) {
      return err(`No GitHub integration configured for ${member.name}. Add it in the team member's profile.`)
    }

    const handle = integration.handle as string
    const config = (integration.config ?? {}) as Record<string, string>

    let scopeFilter = ""
    if (config.repo) {
      scopeFilter = config.repo.includes("/") ? `+repo:${config.repo}` : `+org:${config.repo}`
    }

    const url = `https://api.github.com/search/issues?q=is:pr+author:${encodeURIComponent(handle)}${scopeFilter}&sort=created&order=desc&per_page=15`
    const token = process.env.GITHUB_TOKEN

    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!res.ok) return err(`GitHub API returned ${res.status}`)

    const data = (await res.json()) as { items?: Array<{
      id: number; title: string; html_url: string; state: string;
      pull_request?: { merged_at: string | null }; created_at: string
    }> }

    const items = (data.items ?? []).slice(0, 10).map((item) => {
      const parts = item.html_url.split("/")
      const subtitle = parts.length >= 5 ? `${parts[3]}/${parts[4]}` : ""
      const merged = !!item.pull_request?.merged_at
      return {
        title: item.title,
        url: item.html_url,
        status: merged ? "merged" : item.state === "open" ? "open" : "closed",
        repo: subtitle,
        date: item.created_at,
      }
    })

    return ok({ member_name: member.name, github_handle: handle, activity: items })
  },
)

// ---------------------------------------------------------------------------
// Tool: web_search
// ---------------------------------------------------------------------------
server.tool(
  "web_search",
  "Search the web for current information: salary benchmarks, management frameworks, industry trends.",
  {
    query: z.string().describe("What to search for"),
  },
  async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      return err("Web search not configured. Add TAVILY_API_KEY to your environment.")
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
    })

    if (!res.ok) return err(`Web search failed: HTTP ${res.status}`)

    const data = (await res.json()) as {
      answer?: string
      results?: Array<{ title: string; url: string; content?: string }>
    }

    return ok({
      answer: data.answer ?? null,
      results: (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 400),
      })),
    })
  },
)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal: ${error}\n`)
  process.exit(1)
})
