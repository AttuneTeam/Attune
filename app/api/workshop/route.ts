import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PERSONAS, getPersona } from "@/lib/ai/personas";
import type { PersonaId } from "@/lib/ai/personas";
import {
  formatOrgContext,
  formatTeamValues,
  WORKSHOP_SYNTHESIS_SYSTEM,
} from "@/lib/ai/prompts";

const VALID_PERSONA_IDS = PERSONAS.filter((p) => p.id !== "default").map(
  (p) => p.id,
);

const PersonaAnalysisSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "Think through this problem genuinely from your perspective before structuring anything. What is the core challenge? What do most people get wrong about this? What does your framework reveal that others miss? Write 2-4 paragraphs of real analysis. This is your thinking space — be specific to this question, not generic.",
    ),
  framing: z
    .string()
    .describe(
      "One crisp sentence: how does your lens reframe this problem in a way that changes what to do about it?",
    ),
  key_insights: z
    .array(z.string())
    .max(5)
    .describe(
      "Your most important insights — only include ones that are specific and non-obvious. Fewer sharp insights beat more generic ones. Do not pad.",
    ),
  blind_spots: z
    .string()
    .describe(
      "What this angle tends to miss or underweight — be honest, 1-2 sentences",
    ),
  recommended_actions: z
    .array(
      z.object({
        action: z
          .string()
          .describe(
            "Concrete, specific action — specific enough to do this week or this month",
          ),
        priority: z.enum(["high", "medium", "low"]),
        timeframe: z
          .string()
          .describe("e.g. 'This week', 'Next 30 days', 'Next quarter'"),
        why: z
          .string()
          .describe(
            "Why this action specifically from your perspective — one sentence",
          ),
      }),
    )
    .max(4)
    .describe(
      "Only include actions you would stake your credibility on. Do not pad.",
    ),
  questions_to_explore: z
    .array(z.string())
    .max(3)
    .describe(
      "The most important questions this raises — only include ones that would genuinely change the manager's thinking",
    ),
});

const SynthesisSchema = z.object({
  summary: z
    .string()
    .describe(
      "Answer the manager's question directly in 2-3 sentences. Be specific and opinionated — name the single most important thing to get right. Do not be balanced for balance's sake.",
    ),
  convergence_points: z
    .array(z.string())
    .max(5)
    .describe(
      "Where specialists agree — these are highest-confidence. State the insight, not just that they agree.",
    ),
  divergence_points: z
    .array(
      z.object({
        topic: z.string().describe("The dimension of genuine disagreement"),
        perspectives: z
          .string()
          .describe(
            "What each side argues, and what the manager should weigh when deciding. Help them make a call, don't just present both sides.",
          ),
      }),
    )
    .describe(
      "Only include if the disagreement is a genuine trade-off the manager must navigate",
    ),
  unified_actions: z
    .array(
      z.object({
        action: z
          .string()
          .describe(
            "Specific enough to act on this week or this month — no 'consider' or 'think about'",
          ),
        rationale: z
          .string()
          .describe(
            "Why this is the right move given the full picture — one sharp sentence",
          ),
        priority: z.enum(["high", "medium", "low"]),
        source_personas: z
          .array(z.string())
          .describe("Which specialists support this"),
      }),
    )
    .max(6)
    .describe(
      "The definitive action list. Ruthlessly de-duplicated. Fewer sharp actions beat more generic ones.",
    ),
});

function buildPersonaSystemPrompt(
  personaId: PersonaId,
  orgBlock: string | null,
  valuesBlock: string | null,
  totalPersonas: number,
): string {
  const persona = getPersona(personaId);
  const contextSections = [orgBlock, valuesBlock].filter(Boolean).join("\n\n");

  return `${persona.systemPrompt}

---

WORKSHOP ANALYSIS MODE

You are being consulted as a specialist advisor on a specific management question. A synthesiser will integrate your input with ${totalPersonas - 1} other specialist${totalPersonas > 2 ? "s" : ""}.

How to respond:

1. Fill the \`reasoning\` field first. Think through the problem genuinely from your perspective — what is the core challenge here, what do most people miss, what does your specific framework reveal? Write 2-4 paragraphs of real analysis before touching any other field. This is where the depth should live.

2. Then complete the remaining fields drawing from your reasoning. Be specific to this question — do not reach for generic frameworks. Name actual risks, actual failure modes, actual actions.

3. Only include insights and actions you would stake your credibility on. Do not pad to meet a count. A single sharp insight is worth more than five generic ones.

4. Be distinctively yourself. Your value is your specific lens. The synthesiser will handle integration.

${contextSections ? contextSections + "\n\n" : ""}`;
}

function buildSynthesisPrompt(
  question: string,
  analyses: Array<{
    personaId: string;
    personaName: string;
    analysis: z.infer<typeof PersonaAnalysisSchema>;
  }>,
): string {
  const analysesText = analyses
    .map(
      ({ personaName, analysis }) =>
        `## ${personaName}\n\n**Reasoning:** ${analysis.reasoning}\n\n**Framing:** ${analysis.framing}\n\n**Key insights:**\n${analysis.key_insights.map((i) => `- ${i}`).join("\n")}\n\n**Recommended actions:**\n${analysis.recommended_actions.map((a) => `- [${a.priority}] ${a.action} (${a.timeframe}) — ${a.why}`).join("\n")}\n\n**Blind spots:** ${analysis.blind_spots}`,
    )
    .join("\n\n---\n\n");

  return `Manager's question: "${question}"

${analysesText}

Synthesise these perspectives into a unified advisory view.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, personaIds } = body as {
      question?: string;
      personaIds?: string[];
    };

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length < 10
    ) {
      return NextResponse.json(
        { error: "Question must be at least 10 characters" },
        { status: 400 },
      );
    }
    if (!Array.isArray(personaIds) || personaIds.length === 0) {
      return NextResponse.json(
        { error: "At least one persona must be selected" },
        { status: 400 },
      );
    }
    const validIds = personaIds.filter((id) =>
      VALID_PERSONA_IDS.includes(id as PersonaId),
    ) as PersonaId[];
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "No valid persona IDs provided" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch org context and team values in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ data: orgCtx }, { data: values }] = await Promise.all([
      (supabase as any)
        .from("org_context")
        .select("*")
        .eq("manager_id", user.id)
        .maybeSingle(),
      supabase
        .from("team_values")
        .select("name, description, keywords")
        .eq("manager_id", user.id),
    ]);

    const orgBlock = formatOrgContext(orgCtx ?? null);
    const valuesBlock = formatTeamValues(values ?? []);

    // Phase 1: parallel persona analyses
    const model = openai("gpt-5.4");
    const phase1Results = await Promise.all(
      validIds.map(async (personaId) => {
        const system = buildPersonaSystemPrompt(
          personaId,
          orgBlock,
          valuesBlock,
          validIds.length,
        );
        const { object } = await generateObject({
          model,
          system,
          prompt: question,
          schema: PersonaAnalysisSchema,
        });
        return {
          personaId,
          personaName: getPersona(personaId).name,
          analysis: object,
        };
      }),
    );

    // Phase 2: synthesis
    const { object: synthesis } = await generateObject({
      model,
      system: WORKSHOP_SYNTHESIS_SYSTEM,
      prompt: buildSynthesisPrompt(question, phase1Results),
      schema: SynthesisSchema,
    });

    const personaAnalyses = phase1Results.map(({ personaId, analysis }) => ({
      persona_id: personaId,
      ...analysis,
    }));

    // Persist session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error } = await (supabase as any)
      .from("workshop_sessions")
      .insert({
        user_id: user.id,
        question: question.trim(),
        persona_ids: validIds,
        persona_analyses: personaAnalyses,
        synthesis,
      })
      .select(
        "id, question, persona_ids, persona_analyses, synthesis, created_at",
      )
      .single();

    if (error) {
      console.error("workshop_sessions insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session });
  } catch (err) {
    console.error("Workshop error:", err);
    return NextResponse.json(
      { error: "Failed to run workshop" },
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessions, error } = await (supabase as any)
      .from("workshop_sessions")
      .select(
        "id, question, persona_ids, persona_analyses, synthesis, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (err) {
    console.error("Workshop GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 },
    );
  }
}
