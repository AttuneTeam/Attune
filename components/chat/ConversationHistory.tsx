'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { PERSONAS, type PersonaId } from '@/lib/ai/personas'

type ConversationSummary = {
  id: string
  title: string | null
  updated_at: string
  persona_id: string
}

type Props = {
  onSelect: (id: string, title: string | null, personaId: string) => void
}

export function ConversationHistory({ onSelect }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('chat_conversations')
      .select('id, title, updated_at, persona_id')
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setConversations(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: 'var(--color-muted-foreground)' }} />
          <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: 'var(--color-muted-foreground)' }} />
          <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-muted-foreground)' }} />
        </div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
          No conversations yet
        </p>
        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          Start a new chat to ask anything about your team
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {conversations.map((conv) => {
        const persona = PERSONAS.find((p) => p.id === conv.persona_id)
        const showPersona = persona && persona.id !== 'default'

        return (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelect(conv.id, conv.title, conv.persona_id)}
            className="w-full text-left px-4 py-3 transition-colors hover:bg-black/[0.04] flex flex-col gap-0.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--color-foreground)' }}>
                {conv.title ?? 'Conversation'}
              </span>
              {showPersona && (
                <span
                  className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(0,0,0,0.07)', color: 'var(--color-muted-foreground)' }}
                >
                  {persona.name}
                </span>
              )}
            </div>
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
              {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
            </span>
          </button>
        )
      })}
    </div>
  )
}
