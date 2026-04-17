import type { PersonaId } from "./personas";
import { getPersona } from "./personas";

export const SUMMARIZE_SYSTEM = `You are an expert engineering manager coach analyzing 1-on-1 meeting notes.
Extract the key themes, overall sentiment, and produce a concise professional summary.
Sentiment should be a float from -1.0 (very negative/concerning) to 1.0 (very positive/energized).
Be objective and constructive.`;

export const ACTION_ITEMS_SYSTEM = `You are an expert engineering manager coach extracting action items from 1-on-1 meeting notes.
Extract concrete, actionable tasks that need follow-up. Include due dates when mentioned.
Only extract real commitments and next steps, not general discussion points.`;

export const COACHING_SYSTEM = `You are an expert manager coach.
Given the meeting notes and context, suggest thoughtful follow-up coaching questions
that would help the manager support their team member's growth, address concerns, or deepen understanding.
Use the organisational context (if provided) to calibrate tone and relevance — e.g. a DRI culture calls for ownership questions; a consensus-driven team calls for alignment questions; a sales team's coaching differs from an engineering team's.
Focus on open-ended, empowering questions. Be specific to the content discussed.`;

export type TeamValueInput = {
  name: string;
  description: string | null;
  keywords: string[];
};

export function formatTeamValues(values: TeamValueInput[]): string | null {
  if (!values.length) return null;
  const lines = values.map((v) => {
    const kw = v.keywords?.length
      ? `\n  Keywords: ${v.keywords.join("; ")}`
      : "";
    return `- ${v.name}${v.description ? `\n  ${v.description}` : ""}${kw}`;
  });
  return `Team values (use these to calibrate your analysis):\n${lines.join("\n\n")}`;
}

export type OrgContextInput = {
  company_name?: string | null;
  website?: string | null;
  industry?: string | null;
  company_stage?: string | null;
  company_headcount?: string | null;
  countries?: string[] | null;
  team_function?: string | null;
  team_size?: string | null;
  key_tools?: string[] | null;
  team_methodology?: string | null;
  company_planning?: string | null;
  decision_framework?: string | null;
  team_structure?: string | null;
  okr_cadence?: string | null;
  company_mission?: string | null;
  management_principles?: string | null;
};

export function formatOrgContext(ctx: OrgContextInput | null): string | null {
  if (!ctx) return null;
  const lines: string[] = [];

  // Company
  const companyParts: string[] = [];
  if (ctx.company_name) companyParts.push(`Company: ${ctx.company_name}`);
  if (ctx.industry) companyParts.push(`Industry: ${ctx.industry}`);
  if (ctx.company_stage) companyParts.push(`Stage: ${ctx.company_stage}`);
  if (ctx.company_headcount)
    companyParts.push(`Company headcount: ${ctx.company_headcount}`);
  if (ctx.countries?.length)
    companyParts.push(`Countries: ${ctx.countries.join(", ")}`);
  if (ctx.website) companyParts.push(`Website: ${ctx.website}`);
  if (companyParts.length)
    lines.push(
      "Company context:\n" + companyParts.map((p) => `  ${p}`).join("\n"),
    );

  // Team
  const teamParts: string[] = [];
  if (ctx.team_function) teamParts.push(`Team function: ${ctx.team_function}`);
  if (ctx.team_size) teamParts.push(`Team size: ${ctx.team_size}`);
  if (ctx.key_tools?.length)
    teamParts.push(`Key tools: ${ctx.key_tools.join(", ")}`);
  if (teamParts.length)
    lines.push("Team context:\n" + teamParts.map((p) => `  ${p}`).join("\n"));

  // Ways of Working
  const wowParts: string[] = [];
  if (ctx.team_methodology)
    wowParts.push(`Team methodology: ${ctx.team_methodology}`);
  if (ctx.company_planning)
    wowParts.push(`Company planning cadence: ${ctx.company_planning}`);
  if (ctx.decision_framework)
    wowParts.push(`Decision framework: ${ctx.decision_framework}`);
  if (ctx.team_structure)
    wowParts.push(`Team structure: ${ctx.team_structure}`);
  if (ctx.okr_cadence) wowParts.push(`OKR cadence: ${ctx.okr_cadence}`);
  if (wowParts.length)
    lines.push("Ways of working:\n" + wowParts.map((p) => `  ${p}`).join("\n"));

  // Culture
  const cultureParts: string[] = [];
  if (ctx.company_mission) cultureParts.push(`Mission: ${ctx.company_mission}`);
  if (ctx.management_principles)
    cultureParts.push(`Management principles: ${ctx.management_principles}`);
  if (cultureParts.length)
    lines.push("Culture:\n" + cultureParts.map((p) => `  ${p}`).join("\n"));

  if (!lines.length) return null;
  return `Organisational context (use this to calibrate your analysis):\n${lines.join("\n\n")}`;
}

export function buildChatSystemPrompt({
  managerName,
  orgContext,
  teamValues,
  today,
  personaId,
}: {
  managerName: string;
  orgContext: OrgContextInput | null;
  teamValues: TeamValueInput[];
  today: string;
  personaId?: PersonaId;
}): string {
  const orgBlock = formatOrgContext(orgContext);
  const valuesBlock = formatTeamValues(teamValues);
  const contextSections = [orgBlock, valuesBlock].filter(Boolean).join("\n\n");

  if (!personaId || personaId === "default") {
    return `You are TeamLeader's AI assistant — a calm, analytical thought partner for ${managerName}.

Today is ${today}. All dates are ISO 8601 unless otherwise noted.

${contextSections ? contextSections + "\n\n" : ""}
## Tools
Always prefer calling a tool over relying on assumptions.

## How to respond
- When asked about a person by first name and you haven't identified who is meant, call list_team_members first to resolve the name.
- Synthesise across multiple tool calls when a question spans topics (e.g. sentiment + action items).
- Lead with the insight, support it with specifics from the data.
- Format lists with markdown. Bold names and dates.
- Never fabricate meeting content. If no data is found, say so clearly.
- Note: only interactions where "Summarize" has been clicked are searchable via semantic search. If results seem sparse, mention this.
- Tone: direct, warm, collegial — as a senior executive coach would speak.`;
  }

  const persona = getPersona(personaId);

  return `${persona.systemPrompt}

---

## RESPONSE MODE

Apply the full structured output format only when:
- Analysing a new problem, decision, or challenge for the first time
- A follow-up introduces a genuinely new dimension requiring fresh analysis

For all other exchanges — clarifications, reactions, requests to expand a single point, conversational questions — respond naturally and conversationally. Two focused paragraphs beats re-running the full template.

Let the conversation breathe.

---

You are working with ${managerName}. Today is ${today}. All dates are ISO 8601 unless otherwise noted.

${contextSections ? contextSections + "\n\n" : ""}
## Tools
Always prefer calling a tool over relying on assumptions.

## Data guidelines
- When asked about a person by first name and you haven't identified who is meant, call list_team_members first to resolve the name.
- Never fabricate meeting content. If no data is found, say so clearly.
- Note: only interactions where "Summarize" has been clicked are searchable via semantic search. If results seem sparse, mention this.
- Format lists with markdown. Bold names and dates.`;
}

export const MANAGER_READ_SYSTEM = `You are an expert manager coach synthesising interaction history.
Given the last few summaries and themes from 1-on-1s with a team member, produce 4–5 concise bullet points
that capture the manager's current read on this person.
Focus on: motivations, focus areas, patterns, concerns, and things to keep in mind.
Write each bullet in lowercase, starting with a verb or noun phrase, no trailing period.
Be specific and grounded in the data — avoid generic advice.`;

export const TEAM_PULSE_SYSTEM = `You are an expert manager advisor synthesising people signals across a team.
Given per-member metrics (sentiment, meeting cadence, action item health, goals), identify the most important insights a manager should act on.

Return 5–8 insights covering:
- Risks: people who need attention (negative sentiment trend, not met recently, overdue items piling up)
- Patterns: themes or signals appearing across multiple people (e.g. recurring topics, shared concerns)
- Opportunities: positive signals worth reinforcing or building on

For each insight:
- Write a concrete headline — specific, not generic (name people and numbers where relevant)
- Give a 1–2 sentence detail explaining what the data shows and what to do about it
- Classify as risk, pattern, or opportunity
- Assign priority: high (act this week), medium (act this month), low (worth knowing)
- List the names of affected members

Use the organisational context (if provided) to calibrate — what's a normal cadence for this team?
Be direct, grounded in the data, and prioritise actionability.`;

export const COVERAGE_SYSTEM = `You are an expert manager advisor analyzing a team's role composition.
Given a list of team members and their role areas, identify:
1. Coverage strengths — areas well-covered by multiple people
2. Coverage gaps — important areas with thin or no coverage
3. Single points of failure — capabilities owned by only one person
4. Overlap risks — areas where multiple people have nearly identical scope (potential redundancy or unclear ownership)

Use the organisational context (if provided) to calibrate severity — what counts as a critical gap varies by team function, industry, and ways of working.
Be specific, reference actual role area titles, and prioritize actionability. Keep each finding concise (1-2 sentences).`;

export function extractPlainText(jsonNotes: unknown): string {
  if (!jsonNotes || typeof jsonNotes !== "object") return "";

  function traverse(node: unknown): string {
    if (!node || typeof node !== "object") return "";
    const n = node as Record<string, unknown>;
    if (n.type === "text" && typeof n.text === "string") return n.text;
    if (Array.isArray(n.content)) {
      return (n.content as unknown[])
        .map(traverse)
        .join(n.type === "paragraph" || n.type === "heading" ? "\n" : "");
    }
    return "";
  }

  return traverse(jsonNotes).trim();
}
