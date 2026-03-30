import OpenAI from 'openai'
import { extractPlainText } from './prompts'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

const CHUNK_SIZE = 500  // characters per chunk (roughly 100-125 tokens)

function chunkText(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = current ? current + ' ' + sentence : sentence
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter((c) => c.length > 20)  // skip tiny fragments
}

export async function embedInteraction(interactionId: string, jsonNotes: Json): Promise<void> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const text = extractPlainText(jsonNotes)
  if (!text || text.length < 20) return

  const chunks = chunkText(text)
  if (chunks.length === 0) return

  const supabase = await createClient()

  // Delete old embeddings for this interaction
  await supabase.from('embeddings').delete().eq('interaction_id', interactionId)

  // Embed all chunks in parallel (respecting rate limits — OpenAI batch)
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: chunks,
  })

  const rows = chunks.map((content, i) => ({
    interaction_id: interactionId,
    content,
    content_vector: embeddingResponse.data[i].embedding,
  }))

  await supabase.from('embeddings').insert(rows)
}
