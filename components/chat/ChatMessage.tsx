'use client'

import { ToolCallChip } from './ToolCallChip'

export type ToolCallData = {
  id: string
  name: string
  done: boolean
}

export type ChatMessageData = {
  id: string
  role: 'user' | 'assistant'
  text: string
  toolCalls?: ToolCallData[]
}

type Props = {
  message: ChatMessageData
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-foreground)',
          }}
        >
          {message.text}
        </div>
      </div>
    )
  }

  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0

  return (
    <div className="flex flex-col gap-2">
      {hasToolCalls && (
        <div className="flex flex-wrap gap-1.5">
          {message.toolCalls!.map((tc) => (
            <ToolCallChip key={tc.id} toolName={tc.name} done={tc.done} />
          ))}
        </div>
      )}
      {message.text && (
        <div
          className="prose prose-sm max-w-none text-sm leading-relaxed"
          style={{ color: 'var(--color-foreground)' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }}
        />
      )}
    </div>
  )
}

// Minimal markdown renderer — avoids a full library dependency
function renderMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-semibold mt-3 mb-1">$1</h2>')
    // Unordered lists (must happen before line breaks)
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="my-1 space-y-0.5">$&</ul>')
    // Line breaks — double newline → paragraph break
    .replace(/\n\n+/g, '</p><p class="mt-2">')
    // Wrap in paragraph
    .replace(/^(.+)$/, '<p>$1</p>')
    // Single newlines within paragraphs
    .replace(/(?<!>)\n(?!<)/g, '<br />')
}
