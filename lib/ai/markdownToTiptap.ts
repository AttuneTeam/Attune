/**
 * Converts markdown text to Tiptap JSON (doc format).
 * Handles the patterns produced by the AI chat personas:
 * headings, bullet/ordered lists, bold, italic, inline code, code blocks, paragraphs.
 * Uses no external dependencies to avoid ESM bundler issues.
 */

type TiptapMark = { type: string }
type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: TiptapMark[]
  text?: string
}
export type TiptapDoc = { type: 'doc'; content: TiptapNode[] }

// --- Inline parsing (marks: bold, italic, inline code) ---

function parseInline(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = []
  // Pattern: **bold**, *italic*, _italic_, `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`([^`]+)`)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push({ type: 'text', text: text.slice(last, match.index) })
    }
    if (match[2] !== undefined) {
      // **bold**
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] })
    } else if (match[3] !== undefined) {
      // *italic*
      nodes.push({ type: 'text', text: match[3], marks: [{ type: 'italic' }] })
    } else if (match[4] !== undefined) {
      // _italic_
      nodes.push({ type: 'text', text: match[4], marks: [{ type: 'italic' }] })
    } else if (match[5] !== undefined) {
      // `code`
      nodes.push({ type: 'text', text: match[5], marks: [{ type: 'code' }] })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    nodes.push({ type: 'text', text: text.slice(last) })
  }
  return nodes.length > 0 ? nodes : [{ type: 'text', text }]
}

function paragraph(line: string): TiptapNode {
  return { type: 'paragraph', content: parseInline(line) }
}

// --- Block-level parsing ---

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'bullet'; items: string[] }
  | { kind: 'ordered'; items: string[] }
  | { kind: 'code'; lang: string | null; code: string }
  | { kind: 'paragraph'; lines: string[] }

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip completely blank lines between blocks
    if (line.trim() === '') {
      i++
      continue
    }

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim() || null
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      blocks.push({ kind: 'code', lang, code: codeLines.join('\n') })
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({ kind: 'heading', level: headingMatch[1].length, text: headingMatch[2] })
      i++
      continue
    }

    // Bullet list — collect consecutive bullet lines
    if (/^[-*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'bullet', items })
      continue
    }

    // Ordered list — collect consecutive ordered lines
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ordered', items })
      continue
    }

    // Paragraph — collect until blank line
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|[-*]\s|\d+\.\s|```)/.test(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: 'paragraph', lines: paraLines })
    }
  }

  return blocks
}

function blocksToTiptap(blocks: Block[]): TiptapNode[] {
  const nodes: TiptapNode[] = []

  for (const block of blocks) {
    if (block.kind === 'heading') {
      nodes.push({
        type: 'heading',
        attrs: { level: block.level },
        content: parseInline(block.text),
      })
    } else if (block.kind === 'bullet') {
      nodes.push({
        type: 'bulletList',
        content: block.items.map((item) => ({
          type: 'listItem',
          content: [paragraph(item)],
        })),
      })
    } else if (block.kind === 'ordered') {
      nodes.push({
        type: 'orderedList',
        content: block.items.map((item) => ({
          type: 'listItem',
          content: [paragraph(item)],
        })),
      })
    } else if (block.kind === 'code') {
      nodes.push({
        type: 'codeBlock',
        attrs: { language: block.lang },
        content: [{ type: 'text', text: block.code }],
      })
    } else if (block.kind === 'paragraph') {
      // Each line as a separate paragraph preserves paragraph spacing
      for (const line of block.lines) {
        if (line.trim()) nodes.push(paragraph(line))
      }
    }
  }

  return nodes
}

export function markdownToTiptapJson(markdown: string): TiptapDoc {
  const blocks = parseBlocks(markdown.trim())
  const content = blocksToTiptap(blocks)
  if (content.length === 0) content.push({ type: 'paragraph' })
  return { type: 'doc', content }
}

export function chatMessagesToTiptapJson(
  messages: Array<{ role: string; text: string }>
): TiptapDoc {
  const content: TiptapNode[] = []
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.text.trim()) continue
    const doc = markdownToTiptapJson(msg.text)
    content.push(...doc.content)
    // Blank paragraph between turns
    content.push({ type: 'paragraph' })
  }
  if (content.length === 0) content.push({ type: 'paragraph' })
  return { type: 'doc', content }
}
