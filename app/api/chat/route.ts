import { NextRequest } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import type { PersonaId } from "@/lib/ai/personas";
import { buildChatTools } from "@/lib/ai/chat-tools";

// Approximate token budget for message history (chars / 4 as rough estimate)
const MESSAGE_BUDGET_CHARS = 26_000 * 4;

function trimToTokenBudget(messages: UIMessage[]): UIMessage[] {
  if (messages.length === 0) return messages;

  let totalChars = 0;
  const result: UIMessage[] = [];

  // Always keep the last message (current user query)
  const last = messages[messages.length - 1];
  const lastText = extractTextFromParts(last);
  totalChars += lastText.length;

  // Walk backwards from second-to-last, include as many as fit
  const middle: UIMessage[] = [];
  for (let i = messages.length - 2; i >= 1; i--) {
    const msg = messages[i];
    const text = extractTextFromParts(msg);
    if (totalChars + text.length > MESSAGE_BUDGET_CHARS) break;
    totalChars += text.length;
    middle.unshift(msg);
  }

  // Always include first message for topic anchoring if it fits
  if (messages.length > 1) {
    const first = messages[0];
    const firstText = extractTextFromParts(first);
    if (totalChars + firstText.length <= MESSAGE_BUDGET_CHARS) {
      result.push(first);
    }
  }

  result.push(...middle, last);
  return result;
}

function extractTextFromParts(msg: UIMessage): string {
  if (!msg.parts) return "";
  return msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join(" ");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const {
    conversationId,
    messages,
    personaId,
  }: { conversationId?: string; messages: UIMessage[]; personaId?: PersonaId } =
    await request.json();

  if (!messages || messages.length === 0) {
    return new Response("messages is required", { status: 400 });
  }

  // Resolve or create conversation
  let convId = conversationId;
  if (!convId) {
    const firstUserMsg = messages.find((m) => m.role === "user");
    const firstText = firstUserMsg ? extractTextFromParts(firstUserMsg) : "";
    const title = firstText.slice(0, 60) || "New conversation";

    const { data: conv } = await supabase
      .from("chat_conversations")
      .insert({ manager_id: user.id, title, persona_id: personaId ?? 'default' })
      .select("id")
      .single();

    convId = conv?.id;
  }

  // Load system prompt context in parallel
  const [{ data: orgContext }, { data: teamValues }, { data: profile }] =
    await Promise.all([
      supabase
        .from("org_context")
        .select("*")
        .eq("manager_id", user.id)
        .single(),
      supabase
        .from("team_values")
        .select("name, description, keywords")
        .eq("manager_id", user.id),
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
    ]);

  const system = buildChatSystemPrompt({
    managerName: profile?.full_name ?? "Manager",
    managerRole: profile?.role ?? null,
    orgContext: orgContext ?? null,
    teamValues: teamValues ?? [],
    today: new Date().toISOString().split("T")[0],
    personaId: personaId ?? "default",
  });

  const trimmedMessages = trimToTokenBudget(messages);
  const modelMessages = await convertToModelMessages(trimmedMessages);
  const tools = buildChatTools(supabase, user.id);

  const result = streamText({
    model: openai("gpt-5.4"),
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, steps }) => {
      if (!convId) return;

      const rows: {
        conversation_id: string;
        role: string;
        content: string | null;
        tool_calls: unknown | null;
      }[] = [];

      // Persist the last user message
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMsg) {
        rows.push({
          conversation_id: convId,
          role: "user",
          content: extractTextFromParts(lastUserMsg),
          tool_calls: null,
        });
      }

      // Persist assistant turns from each step
      for (const step of steps) {
        if (step.text || step.toolCalls?.length) {
          rows.push({
            conversation_id: convId,
            role: "assistant",
            content: step.text || null,
            tool_calls: step.toolCalls?.length ? step.toolCalls : null,
          });
        }
      }

      if (rows.length > 0) {
        await supabase.from("chat_messages").insert(rows);
      }
    },
  });

  // Build response with conversation ID header
  const streamResponse = result.toUIMessageStreamResponse();
  const headers = new Headers(streamResponse.headers);
  if (convId) headers.set("X-Conversation-Id", convId);

  return new Response(streamResponse.body, {
    status: streamResponse.status,
    headers,
  });
}
