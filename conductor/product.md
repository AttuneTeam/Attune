# Product Definition: TeamLeader

## Vision

TeamLeader is an AI-augmented management workspace for people managers. It replaces
scattered 1-on-1 notes, spreadsheets, and mental context-switching with a single system
that captures every interaction with a direct report, then reasons over that history:
summarising conversations, extracting action items, tracking sentiment trends,
suggesting coaching questions, and surfacing signals against strategic initiatives
before the manager notices a problem. It pulls context from where work actually happens
— Google Calendar, GitHub, Slack, Jira — and layers agentic AI loops on top, so the tool
doesn't just store what a manager wrote down; it tells them what to pay attention to next.

## Product Type

**Commercial SaaS.** TeamLeader is built to be sold to managers outside the founding
organisation. This is a first-class architectural constraint, not an aspiration:

- **Multi-tenancy is non-negotiable.** Every table carries an ownership path back to a
  manager, and Row-Level Security enforces it at the database layer. No query may rely
  on application code alone for isolation.
- **Onboarding must work with zero hand-holding.** A new manager signing up cold must
  reach value without a seed script, a migration, or a support conversation.
- **Integrations are per-tenant.** Credentials for GitHub, Slack, Google Calendar and
  Jira are stored per manager, never as shared environment configuration.
- The `(marketing)` route group — landing and pricing — is real product surface, not a
  placeholder.

## Primary User

**Any people manager**, with engineering managers as the sharpest early adopter.

The product optimises for the person who runs recurring 1-on-1s and is accountable for
a team's health and delivery. When a trade-off arises, it resolves in favour of that
person's daily loop.

An important consequence: **engineering-specific integrations are optional depth, never
the spine.** GitHub, Cursor and Jira context enrich the experience for an engineering
manager, but a sales manager, a design lead or an operations manager must get a
complete, coherent product without connecting any of them. No core workflow may
hard-depend on a code-hosting integration.

## Success Criteria

TeamLeader is succeeding when all four of these hold:

### 1. Nothing falls through the cracks
Every commitment, action item and follow-up raised in a conversation is captured and
chased. A manager should never rediscover a forgotten promise weeks later.

### 2. Proactive signal, not passive storage
The product earns its place by telling the manager something they did not already know.
Sentiment declines, 1-on-1 coverage gaps, and at-risk initiatives surface *before* the
manager notices them. A tool that only stores what was typed into it has failed this bar.

### 3. Meeting prep time collapses
Walking into a 1-on-1 fully briefed takes seconds, not twenty minutes of scrolling back
through old notes. Context is assembled for the manager, not retrieved by them.

### 4. Strategy connects to conversations
Strategic initiatives are visibly linked to what is actually being said in 1-on-1s.
Strategy and the ground truth of team conversations are one system, not two that drift
apart.

## Non-Goals

These are deliberate exclusions. Proposals that pull the product toward any of them
should be rejected by default, and accepted only with an explicit, recorded decision to
change this document.

### Not formal HR or performance review
No compensation, promotion packets, calibration, or system-of-record duties for HR.
TeamLeader is a manager's private thinking and preparation tool. This is what allows it
to be candid.

### Not project or ticket management
Not a Jira replacement. TeamLeader *reads from* delivery tools to build context; it does
not run sprints, own tickets, or become the place work is tracked.

### Not employee surveillance
No productivity scoring, no activity monitoring, no ranking of individuals. Integrations
exist to give a manager context for a better conversation — never oversight or
measurement of a person. Any feature that would read to a direct report as monitoring is
out of scope regardless of its utility to the manager.

### Not a chat or messaging platform
Not competing with Slack. Conversational chat exists solely as an AI interface over the
manager's own data — a way to ask questions of the workspace, not a channel for talking
to people.

## Core Capabilities

| Capability | What it does |
|---|---|
| Interactions | Rich-text (Tiptap) capture of 1-on-1s and other conversations, per team member |
| Agentic processing | One "Process" action runs an AI loop: summarise, extract action items, generate coaching questions, check sentiment history, escalate if warranted |
| Action items | Unified tracking across interactions and personal to-dos, with status and due dates |
| Semantic search | pgvector similarity search across the full history of conversations |
| Team pulse | Sentiment trends, coverage gaps, and themes rolled up across the team |
| Strategies & initiatives | Nested strategic initiatives, with signals extracted from interactions |
| Roles & goals | Role definitions, role areas, and per-member goals |
| Daily briefing | Assembled context for the day ahead |
| Workshop | Persona-based analysis and synthesis space |
| Chat | Tool-using AI assistant scoped to the manager's own data |
| Integrations | Google Calendar, GitHub, Slack, Jira, Confluence, Trello, Cursor |

## Current State

The product is a working application, deployed to Vercel with Supabase migrations
applied via GitHub Actions on push to `main`. It is beyond prototype and in active
feature development.

**Known documentation drift:** `ARCHITECTURE.md` describes an earlier shape of the
product ("meetings", four migrations, an internal single-user tool). The codebase has
since moved to "interactions", forty migrations, and the commercial direction described
above. Treat this document as authoritative on product intent, and refresh
`ARCHITECTURE.md` as a near-term chore.
