import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const CHUNK_SIZE = 500

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
  return chunks.filter((c) => c.length > 20)
}

export async function embedKnowledgeDocument(
  documentId: string,
  managerId: string,
  content: string
): Promise<void> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const supabase = await createClient()

  const chunks = chunkText(content)
  if (chunks.length === 0) return

  // Delete existing chunks for this document
  await supabase.from('knowledge_chunks').delete().eq('document_id', documentId)

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: chunks,
  })

  const rows = chunks.map((chunkContent, i) => ({
    document_id: documentId,
    manager_id: managerId,
    content: chunkContent,
    content_vector: embeddingResponse.data[i].embedding,
    chunk_index: i,
  }))

  await supabase.from('knowledge_chunks').insert(rows)
}
