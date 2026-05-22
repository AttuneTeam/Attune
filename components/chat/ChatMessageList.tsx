'use client'

import { ChatMessage } from './ChatMessage'
import type { ChatMessageData } from './ChatMessage'

type Props = {
  messages: ChatMessageData[]
  isStreaming: boolean
}

export function ChatMessageList({ messages, isStreaming }: Props) {

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--color-accent)' }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-5 w-5"
            style={{ color: 'var(--color-primary)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            Ask anything about your team
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Interaction history, goals, action items, GitHub activity, coverage gaps
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isStreaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.text && !messages[messages.length - 1]?.toolCalls?.length && (
        <div className="flex gap-1 pl-1">
          <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: 'var(--color-muted-foreground)' }} />
          <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: 'var(--color-muted-foreground)' }} />
          <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-muted-foreground)' }} />
        </div>
      )}
    </div>
  )
}
