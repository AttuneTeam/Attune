# Agentic AI Roadmap

Use cases identified for introducing agentic behaviour into TeamLeader. Each case replaces a manual, user-triggered step with an AI loop that reasons about context, decides what to do, and takes action autonomously.

**Agentic** means the AI controls the loop — it receives context, calls tools based on what it finds, and branches on intermediate results. It is not a fixed pipeline.

---

## ✅ 1. Post-Interaction Processing Pipeline

**Status: Shipped**

Single "Process" button on the interaction editor triggers a `streamText` agent loop with five tools: summarize, extract action items, generate coaching questions, check sentiment history, create escalation reminder. The AI reasons out loud and decides whether escalation is warranted based on what `check_sentiment_history` returns. Action items are scoped to the individual or the manager based on whether they are person-specific or company/team-wide.

Streaming reasoning is displayed in a third column as the agent works.

---

## 2. Pre-Meeting Prep Agent

**Trigger:** Manager opens an upcoming interaction, or a scheduled job runs 24h before a meeting.

**What makes it agentic:** Given a meeting context, the agent independently decides what information is most relevant, synthesises across multiple data sources, and produces a structured brief — without knowing in advance what it will find.

**Agent reasoning chain:**
1. Identify the upcoming meeting and who it is with
2. Gather context in parallel: last 3 interactions (summaries, themes, sentiment), open action items, current goals, GitHub activity since last meeting
3. Synthesise: what are the open threads? What was the last tone of conversation? What progress has been made on goals?
4. Generate pre-meeting brief:
   - Key context to recall (2–3 bullets from recent history)
   - Open action items to review
   - Suggested talking points (goals + GitHub + sentiment)
   - 2–3 coaching questions tailored to this person's current context
5. Write suggested items to `agenda_items` table with an "AI suggested" marker

**Produces:** Pre-populated agenda items the manager can review and edit before the meeting starts.

**Implementation path:**
- New API route: `POST /api/ai/prep-meeting` — takes `{ interactionId }`
- Triggered when manager opens an upcoming interaction editor (lazy) or via a daily scheduled job
- Uses existing: `COACHING_SYSTEM` prompt, `agenda_items` table, `app/api/integrations/github/route.ts`
- Key files: `components/meetings/AgendaItemsSidebar.tsx`, `components/meetings/InteractionEditorClient.tsx`

---

## 3. Sentiment Escalation Agent

**Trigger:** Runs automatically after every interaction is processed (post-summarization).

**What makes it agentic:** Rather than a hardcoded threshold check, the agent reasons about a trend over time, weighs severity and context, and decides the appropriate managerial response — including generating a tailored conversation guide.

**Agent reasoning chain:**
1. Check streak: how many of the last N interactions with this member had sentiment < -0.2?
2. Decision gates:
   - 1 negative: no action (normal variance)
   - 2 consecutive: generate a re-engagement coaching nudge; surface in next briefing
   - 3+ consecutive: escalation — create a priority reminder, generate a conversation guide, schedule a follow-up within 3 days
3. If escalating:
   - Create high-priority `personal_items` reminder (due in 3 days)
   - Generate a "difficult conversation guide" — what to ask, what to avoid, likely root causes based on recurring themes
   - Annotate `team_members.manager_read` with the escalation flag
4. If recovering (was negative, now positive): generate a reinforcement nudge

**Produces:** Proactive alerts and coaching guidance that surface before the manager notices there is a problem.

**Implementation path:**
- Extend `app/api/ai/summarize/route.ts` with a background escalation step (post-summary)
- New helper: `lib/ai/escalation.ts` — checks streak, decides tier, generates response
- Uses existing: `COACHING_NUDGES_SYSTEM` prompt, `personal_items` table, `team_members.coaching_nudges`

**Note:** A lightweight version of this is already wired into the Post-Interaction Pipeline (use case 1) via the `check_sentiment_history` and `create_escalation_reminder` tools. This use case formalises it as a standalone background agent and adds the conversation guide generation.

---

## 4. Weekly Team Health Agent

**Trigger:** Scheduled — runs every Monday morning. Can also be triggered manually from the dashboard.

**What makes it agentic:** The agent surveys the whole team, identifies which members warrant deeper investigation, runs additional analysis on at-risk members, and produces a prioritised report. The scope and depth of analysis adapts to what it finds.

**Agent reasoning chain:**
1. Survey all direct reports: last interaction date, sentiment trend (last 5), open action items, goal status, GitHub activity
2. Identify at-risk signals:
   - Not met in >14 days
   - Declining sentiment trend (last 3 < prior 3)
   - >3 overdue action items
   - GitHub activity drop (>50% below 4-week average)
   - Goals with no recent progress or action items
3. For each at-risk member, deep-dive:
   - What themes are recurring in their interactions?
   - Are their goals achievable this quarter?
   - Are their action items the same ones as last week (stuck)?
4. Cross-team pattern detection:
   - Are multiple members mentioning the same themes (e.g., "overload", "unclear priorities")?
   - If yes: flag as a systemic issue, not an individual one
5. Generate team health report:
   - 3–5 prioritised risk items with recommended actions
   - 1–2 positive signals to reinforce
   - Team-level theme clusters
   - Members to prioritise this week
6. Store in `team_pulse_snapshots`, surface in dashboard

**Produces:** A Monday morning briefing that replaces the current manual "Team Pulse" button.

**Implementation path:**
- Extend `app/api/ai/team-pulse/route.ts` — already does ~80% of the data gathering
- Add cross-member theme clustering: group interactions by theme keywords, detect overlap
- Add scheduling via Supabase `pg_cron` or a Next.js cron route
- Surface in `app/(dashboard)/page.tsx` alongside the daily briefing
- Key files: `app/api/ai/team-pulse/route.ts`, `lib/ai/prompts.ts` (`TEAM_PULSE_SYSTEM`)

---

## 5. Goal–Action Item Bridge Agent

**Trigger:** When action items are created (via extraction or manually) or when a goal is updated.

**What makes it agentic:** The agent reasons about semantic relevance between free-text action items and free-text goals, decides whether the link is meaningful enough to surface, and flags goals that appear to be drifting with no supporting work.

**Agent reasoning chain:**
1. New action item created → embed its description
2. Retrieve member's active goals → embed their descriptions
3. Cosine similarity check: is this action item semantically close to an existing goal?
4. If similarity > 0.75: suggest linking the action item to that goal (UI prompt in action items sidebar)
5. Goal staleness scan (runs weekly alongside team health agent):
   - Find goals in current quarter with no action items created in the last 30 days
   - Find goals with status "not_started" past the quarter midpoint
   - Flag as "at risk" and add a suggested check-in to the next briefing

**Produces:** Automatic connections between daily work (action items) and stated goals, plus proactive alerts when goals are drifting.

**Implementation path:**
- New API route: `POST /api/ai/link-goals` — takes `{ actionItemId }`, runs embedding similarity
- Called from `app/api/ai/process-interaction/route.ts` (or `app/api/ai/action-items/route.ts`) after inserting new items
- Goal staleness check added to the weekly team health agent
- Uses existing pgvector pattern from `lib/ai/embeddings.ts` (replicate for `member_goals` table)
- Key files: `app/api/ai/action-items/route.ts`, `lib/ai/embeddings.ts`, `member_goals` table

---

## Architecture pattern

All five use cases follow the same shape:

```
Trigger (user action / schedule / state change)
    ↓
Orchestration route — streamText with tools
    ↓
Context gathering (parallel Supabase queries)
    ↓
AI reasoning loop — decides which tools to call based on intermediate results
    ↓
Side effects (DB writes, agenda items, reminders)
    ↓
Stream or response (reasoning visible, outcomes stored)
```

The chat system's `lib/ai/chat-tools.ts` tool definitions encode much of the data-access logic already. New agentic routes are primarily scheduled or triggered versions of what the chat agent does conversationally.

---

## Priority

| Use case | Value | Complexity | When |
|---|---|---|---|
| ✅ Post-Interaction Pipeline | Very high | Low | Done |
| Pre-Meeting Prep | High | Medium | Next |
| Sentiment Escalation | High | Low | Next |
| Weekly Team Health | Medium | Medium | After |
| Goal–Action Item Bridge | Medium | Medium | After |
