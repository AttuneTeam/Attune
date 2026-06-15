'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
        <div className="prose prose-sm max-w-none text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" style={{ color: 'var(--color-foreground)' }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Headings
              h1: ({ children }) => <h1 className="text-base font-semibold mt-4 mb-1">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-0.5">{children}</h3>,
              // Paragraphs
              p: ({ children }) => <p className="mb-2">{children}</p>,
              // Lists
              ul: ({ children }) => <ul className="my-1.5 ml-4 space-y-0.5 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-1.5 ml-4 space-y-0.5 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="leading-snug">{children}</li>,
              // Horizontal rule
              hr: () => <hr className="my-3 border-current opacity-15" />,
              // Inline code
              code: ({ children, className }) => {
                const isBlock = className?.startsWith('language-')
                if (isBlock) {
                  return (
                    <code className="block rounded px-3 py-2 my-2 text-xs font-mono overflow-x-auto" style={{ background: 'var(--color-surface-dim)' }}>
                      {children}
                    </code>
                  )
                }
                return (
                  <code className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: 'var(--color-surface-dim)' }}>
                    {children}
                  </code>
                )
              },
              pre: ({ children }) => <pre className="not-prose">{children}</pre>,
              // Strong / em
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
