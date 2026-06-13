import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types & schemas
//
// A persona is a STRUCTURED, READABLE synthesis — not embeddings. Embeddings
// are the citation index over raw sources; the persona is the thing you read,
// cite, and diff over time. Every claim carries its evidence and its epistemic
// status (observation vs inference) so it is trustworthy enough to act on.
// ---------------------------------------------------------------------------

const CitationSchema = z.object({
  source_type: z.enum(["interaction", "review", "goal", "comment"]),
  source_id: z
    .string()
    .describe("interactions.id (or goal/document id) the claim is drawn from"),
  date: z
    .string()
    .describe("ISO date of the SOURCE (not now) — carries recency weight"),
  quote: z
    .string()
    .describe("Short phrase (<=200 chars) from the source that supports the claim"),
});

const ClaimSchema = z.object({
  claim: z.string(),
  type: z
    .enum(["observation", "inference"])
    .describe("observation = what was said/done; inference = what it might mean"),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z
    .array(CitationSchema)
    .describe("Observations require >=1 citation. Inferences cite what they infer from."),
  trend: z
    .enum(["emerging", "stable", "fading"])
    .nullable()
    .describe("Direction of this claim over time, or null if not applicable"),
  first_seen: z.string().describe("ISO date of the oldest supporting evidence"),
  last_seen: z.string().describe("ISO date of the newest supporting evidence"),
});

const FIELD_KEYS = [
  "communication_style",
  "motivators",
  "stress_signature",
  "feedback_that_lands",
  "growth_edge",
  "open_threads",
] as const;

const FieldsSchema = z.object({
  communication_style: z.array(ClaimSchema).max(6),
  motivators: z.array(ClaimSchema).max(6),
  stress_signature: z.array(ClaimSchema).max(6),
  feedback_that_lands: z.array(ClaimSchema).max(6),
  growth_edge: z.array(ClaimSchema).max(6),
  open_threads: z.array(ClaimSchema).max(6),
});

export const PersonaContentSchema = z.object({
  one_liner: z.string().describe("One sentence: how it is to work with this person"),
  fields: FieldsSchema,
  as_of: z.string().describe("ISO date of the latest evidence folded in"),
});

export type PersonaContent = z.infer<typeof PersonaContentSchema>;
export type PersonaClaim = z.infer<typeof ClaimSchema>;
export type Citation = z.infer<typeof CitationSchema>;

const ClaimRefSchema = z.object({
  field: z.enum(FIELD_KEYS),
  claim: z.string(),
});

const DeltaSchema = z.object({
  added: z.array(ClaimRefSchema),
  reinforced: z.array(ClaimRefSchema),
  changed: z.array(
    z.object({
      field: z.enum(FIELD_KEYS),
      before: z.string(),
      after: z.string(),
      why: z.string(),
    }),
  ),
  stale: z.array(ClaimRefSchema),
});

// The fold contract: nothing changed, OR a new persona + the diff that produced it.
// `changed: false` is a first-class outcome — most interactions are no-ops.
const FoldResultSchema = z.object({
  changed: z.boolean(),
  reason: z.string().describe("Why the persona changed, or why this was a no-op"),
  version_note: z
    .string()
    .nullable()
    .describe("One line summarising the change, or null if no change"),
  persona: PersonaContentSchema.nullable().describe(
    "The full updated persona when changed, otherwise null",
  ),
  delta: DeltaSchema.nullable().describe(
    "What changed vs the current persona, otherwise null",
  ),
});

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const PERSONA_GUARDRAILS = `GUARDRAILS (non-negotiable):
- This is a model of the MANAGER'S RELATIONSHIP and observations — frame everything as "how working with this person has gone", never as a fixed verdict on who they are.
- The read-it-aloud test: every claim must be one you would be comfortable with the person themselves reading.
- Reviews inform goals and growth-edge; directly observed interactions own communication style and stress signature. When a polished review contradicts candid interaction notes on HOW someone shows up, the interactions win.
- Never invent dates. Use only the dates provided. Citation dates are the SOURCE's date.
- An observation-type claim MUST include at least one citation. If you cannot cite it, it is an inference.`;

export const PERSONA_FOLD_SYSTEM = `You maintain a living persona of a team member, built only from the manager's own interaction records. You are folding ONE new interaction into the current persona and deciding whether it changes anything.

DECIDE IF REQUIRED — most interactions are no-ops.
Set "changed": false unless the new interaction does one of:
  (a) introduces a genuinely new claim,
  (b) adds support to / raises or lowers confidence in / CONTRADICTS an existing claim,
  (c) shifts a trend (emerging->stable, stable->fading).
Logistics, scheduling, status updates, and idle conversation are no-ops. When in doubt, no-op.

CONFIDENCE IS EARNED, NOT GRANTED.
- A single observation creates AT MOST a "low"-confidence claim, with first_seen = last_seen = its date.
- Raise confidence only when independent LATER evidence supports the same claim (the "reinforced" path); extend last_seen.
- One contradicting observation should LOWER confidence or flag the claim — never silently flip it.

STABILITY.
- When changed: true, return the COMPLETE updated persona, not a patch.
- Preserve unchanged claims VERBATIM (byte-for-byte) so diffs stay meaningful.
- Carry forward every still-valid claim from the current persona; only touch what the new evidence affects.

DELTA.
- added: brand-new claims. reinforced: existing claims with new support/confidence. changed: reworded/shifted claims (give before/after/why). stale: claims now contradicted or unsupported (demote or drop).

${PERSONA_GUARDRAILS}

If changed: false, you may omit "persona" and "delta". If changed: true, both are required, plus a one-line "version_note".`;

export const PERSONA_BACKFILL_SYSTEM = `You build the FIRST version of a living persona for a team member from their full history of interactions (and any prior reviews/goals). This is a cold start: synthesise everything into a structured, evidence-anchored profile.

For each field, write only claims the evidence actually supports — no filler, no generic personality traits. Calibrate confidence to how much evidence exists and how recent it is: a pattern seen across many recent 1-on-1s is "high"; a single old mention is "low". Set first_seen/last_seen from the actual source dates, and mark "trend" where the arc is visible (e.g. a concern that has faded, a strength that is emerging).

Fields:
- communication_style: how they engage (async/sync, direct/indirect, needs prep vs thinks out loud)
- motivators: what visibly lifts them
- stress_signature: HOW strain shows up for them specifically (withdrawal, over-commitment, terseness)
- feedback_that_lands: framings that have worked — and ones that backfired
- growth_edge: the recurring development theme
- open_threads: live commitments/goals and their status (include ones that have gone quiet/stale)

${PERSONA_GUARDRAILS}

Return the full persona. Older formal sources (reviews) are baseline; recent interactions are current state — weight accordingly.`;

// ---------------------------------------------------------------------------
// Fold: ride the process-interaction background task. One settled "Process"
// click = one fold attempt. The no-op gate means re-processing is safe and
// writes nothing.
// ---------------------------------------------------------------------------

type FoldParams = {
  memberId: string;
  memberName: string;
  memberLevel?: string | null;
  managerId: string;
  interactionId: string;
};

export async function foldPersona(
  supabase: SupabaseClient,
  { memberId, memberName, memberLevel, managerId, interactionId }: FoldParams,
): Promise<void> {
  // The interaction has just been summarised; fold the summary, not raw notes.
  const { data: ix } = await supabase
    .from("interactions")
    .select("id, scheduled_at, type, ai_summary, key_themes, sentiment_score")
    .eq("id", interactionId)
    .single();
  if (!ix || !ix.ai_summary) return;

  const { data: current } = await supabase
    .from("member_personas")
    .select("version, content, source_counts")
    .eq("member_id", memberId)
    .maybeSingle();

  const date = ix.scheduled_at ? ix.scheduled_at.slice(0, 10) : "unknown";
  const evidenceBlock = [
    "New interaction to fold in:",
    `- id: ${ix.id}`,
    `- date: ${date}`,
    `- type: ${ix.type}`,
    `- sentiment: ${ix.sentiment_score ?? "n/a"}`,
    `- themes: ${(ix.key_themes ?? []).join(", ") || "none"}`,
    `- summary: ${ix.ai_summary}`,
  ].join("\n");

  const currentBlock = current?.content
    ? `Current persona (JSON):\n${JSON.stringify(current.content, null, 2)}`
    : `No persona exists yet. Create the first version from this single interaction. Be conservative — a single interaction supports only low-confidence claims.`;

  const { object } = await generateObject({
    model: openai("gpt-5.4-mini"),
    system: PERSONA_FOLD_SYSTEM,
    prompt: [
      `Team member: ${memberName}${memberLevel ? ` (${memberLevel})` : ""}`,
      currentBlock,
      evidenceBlock,
    ].join("\n\n"),
    schema: FoldResultSchema,
  });

  if (!object.changed || !object.persona) return;

  const nextVersion = (current?.version ?? 0) + 1;
  const nowIso = new Date().toISOString();
  const prevCounts = (current?.source_counts ?? {}) as Record<string, number>;
  const sourceCounts = {
    ...prevCounts,
    interactions: (prevCounts.interactions ?? 0) + 1,
  };

  await supabase.from("member_personas").upsert(
    {
      member_id: memberId,
      manager_id: managerId,
      version: nextVersion,
      content: object.persona,
      source_counts: sourceCounts,
      generated_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "member_id" },
  );

  await supabase.from("member_persona_versions").insert({
    member_id: memberId,
    manager_id: managerId,
    version: nextVersion,
    content: object.persona,
    delta: { ...(object.delta ?? {}), note: object.version_note ?? null },
    trigger: `fold:${interactionId}`,
    generated_at: nowIso,
  });
}

// ---------------------------------------------------------------------------
// Backfill: one-time cold start over a member's whole summarised history,
// on the smarter model. Writes version 1.
// ---------------------------------------------------------------------------

export async function backfillPersona(
  supabase: SupabaseClient,
  { memberId, memberName, memberLevel, managerId }: Omit<FoldParams, "interactionId">,
): Promise<{ created: boolean; reason?: string }> {
  const { data: history } = await supabase
    .from("interactions")
    .select("id, scheduled_at, type, ai_summary, key_themes, sentiment_score")
    .eq("participant_id", memberId)
    .not("ai_summary", "is", null)
    .order("scheduled_at", { ascending: true });

  if (!history || history.length === 0)
    return { created: false, reason: "no_summarised_interactions" };

  type HistoryRow = {
    id: string;
    scheduled_at: string | null;
    type: string;
    ai_summary: string | null;
    key_themes: string[] | null;
    sentiment_score: number | null;
  };

  const historyBlock = (history as HistoryRow[])
    .map((h) => {
      const date = h.scheduled_at ? h.scheduled_at.slice(0, 10) : "unknown";
      const themes = (h.key_themes ?? []).join(", ");
      const score = h.sentiment_score !== null ? `, sentiment ${h.sentiment_score}` : "";
      return `[${h.type} | id: ${h.id} | ${date}${score}]\n${h.ai_summary}${themes ? `\nThemes: ${themes}` : ""}`;
    })
    .join("\n\n");

  const { object: persona } = await generateObject({
    model: openai("gpt-5.4"),
    system: PERSONA_BACKFILL_SYSTEM,
    prompt: [
      `Team member: ${memberName}${memberLevel ? ` (${memberLevel})` : ""}`,
      `Full interaction history (oldest first):`,
      historyBlock,
    ].join("\n\n"),
    schema: PersonaContentSchema,
  });

  const nowIso = new Date().toISOString();
  const { error: upsertError } = await supabase.from("member_personas").upsert(
    {
      member_id: memberId,
      manager_id: managerId,
      version: 1,
      content: persona,
      source_counts: { interactions: history.length },
      generated_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "member_id" },
  );

  if (upsertError) {
    console.error("Persona backfill upsert error:", upsertError);
    return { created: false, reason: `write_failed: ${upsertError.message}` };
  }

  const { error: versionError } = await supabase
    .from("member_persona_versions")
    .insert({
      member_id: memberId,
      manager_id: managerId,
      version: 1,
      content: persona,
      delta: {},
      trigger: "backfill",
      generated_at: nowIso,
    });

  if (versionError) {
    console.error("Persona backfill version insert error:", versionError);
    return { created: false, reason: `version_write_failed: ${versionError.message}` };
  }

  return { created: true };
}
