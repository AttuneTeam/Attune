import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { AREA_SUGGESTIONS_SYSTEM } from "@/lib/ai/prompts"
import { areaSuggestionsSchema, buildAreaSuggestionPrompt } from "@/lib/map/suggestSchema"

/**
 * Turns a brain dump into a proposed set of areas.
 *
 * This route writes nothing. FR4 requires that nothing reaches the database
 * until the manager has read the proposal and accepted it — "AI is offered,
 * never imposed" is a product principle, and a route that quietly created rows
 * would break it no matter how good the suggestions were.
 */

const suggestInput = z
  .object({
    text: z
      .string()
      .trim()
      // Nothing useful comes out of three words, and asking the model anyway
      // invites it to invent something to justify the call.
      .min(20, "Write a little more and I will have something to work with.")
      .max(20_000, "That is more than one sitting. Try it in a couple of passes."),
  })
  .strict()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = suggestInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    )
  }

  // Read-only. The manager's own domains go to the model so it reuses them
  // instead of coining a parallel vocabulary.
  const { data: domains } = await supabase
    .from("map_domains")
    .select("name")
    .eq("manager_id", user.id)
    .order("sort_order", { ascending: true })

  const existing = ((domains ?? []) as { name: string }[]).map((d) => d.name)

  try {
    const { object } = await generateObject({
      // The client is constructed here, in the handler, not at module level.
      model: openai("gpt-5.4-mini"),
      system: AREA_SUGGESTIONS_SYSTEM,
      prompt: buildAreaSuggestionPrompt(parsed.data.text, existing),
      schema: areaSuggestionsSchema,
    })

    // Validated again on our side. generateObject enforces the shape, but this
    // is the boundary where untrusted output becomes something we hand to the
    // interface, and the caps and strictness are ours to guarantee.
    const checked = areaSuggestionsSchema.safeParse(object)
    if (!checked.success) {
      return NextResponse.json(
        { error: "The suggestions came back in a shape I could not use." },
        { status: 502 },
      )
    }

    return NextResponse.json({ areas: checked.data.areas })
  } catch {
    // The upstream message is never shown to the manager: it is noise at best
    // and leaks provider detail at worst.
    return NextResponse.json(
      { error: "Suggestions are unavailable right now. Nothing has been changed." },
      { status: 502 },
    )
  }
}
