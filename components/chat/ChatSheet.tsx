'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from './ChatInput'
import { ConversationHistory } from './ConversationHistory'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessageData, ToolCallData } from './ChatMessage'

type UIMessageChunk =
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown }
  | { type: 'tool-input-start'; toolCallId: string; toolName: string }
  | { type: 'error'; errorText: string }
  | { type: string }

type StoredToolCall = { toolCallId: string; toolName: string }

type View = 'chat' | 'history'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChatSheet({ open, onOpenChange }: Props) {
  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [status, setStatus] = useState<'ready' | 'streaming' | 'error'>('ready')
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [conversationTitle, setConversationTitle] = useState<string | undefined>()
  const [loadingHistory, setLoadingHistory] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setConversationId(undefined)
    setConversationTitle(undefined)
    setStatus('ready')
    setView('chat')
  }, [])

  const loadConversation = useCallback(async (id: string, title: string | null) => {
    setLoadingHistory(true)
    setView('chat')
    setConversationId(id)
    setConversationTitle(title ?? undefined)

    const supabase = createClient()
    const { data: rows } = await supabase
      .from('chat_messages')
      .select('id, role, content, tool_calls')
      .eq('conversation_id', id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })

    const loaded: ChatMessageData[] = (rows ?? []).map((row) => {
      const toolCalls: ToolCallData[] =
        Array.isArray(row.tool_calls)
          ? (row.tool_calls as StoredToolCall[])
              .filter((tc) => tc.toolName)
              .map((tc) => ({ id: tc.toolCallId, name: tc.toolName, done: true }))
          : []

      return {
        id: row.id,
        role: row.role as 'user' | 'assistant',
        text: row.content ?? '',
        toolCalls,
      }
    })

    setMessages(loaded)
    setLoadingHistory(false)
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (status === 'streaming') return

      const userMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: 'user',
        text,
      }
      const assistantMsgId = crypto.randomUUID()
      const assistantMsg: ChatMessageData = {
        id: assistantMsgId,
        role: 'assistant',
        text: '',
        toolCalls: [],
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setStatus('streaming')

      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        const historyMessages = [...messages, userMsg]
        const uiMessages = historyMessages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: m.text }],
        }))

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, messages: uiMessages }),
          signal: ctrl.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const newConvId = res.headers.get('X-Conversation-Id')
        if (newConvId && !conversationId) setConversationId(newConvId)

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentText = ''
        const toolCalls: ToolCallData[] = []

        const updateAssistant = (text: string, tools: ToolCallData[]) => {
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { id: assistantMsgId, role: 'assistant', text, toolCalls: [...tools] },
          ])
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') break

            let chunk: UIMessageChunk
            try {
              chunk = JSON.parse(data) as UIMessageChunk
            } catch {
              continue
            }

            if (chunk.type === 'text-delta') {
              currentText += (chunk as { type: 'text-delta'; delta: string }).delta
              updateAssistant(currentText, toolCalls)
            } else if (chunk.type === 'tool-input-available') {
              const tc = chunk as { type: 'tool-input-available'; toolCallId: string; toolName: string }
              if (!toolCalls.find((t) => t.id === tc.toolCallId)) {
                toolCalls.push({ id: tc.toolCallId, name: tc.toolName, done: false })
                updateAssistant(currentText, toolCalls)
              }
            } else if (chunk.type === 'tool-input-start') {
              const tc = chunk as { type: 'tool-input-start'; toolCallId: string; toolName: string }
              if (!toolCalls.find((t) => t.id === tc.toolCallId)) {
                toolCalls.push({ id: tc.toolCallId, name: tc.toolName, done: false })
                updateAssistant(currentText, toolCalls)
              }
            } else if (chunk.type === 'tool-output-available') {
              const tc = chunk as { type: 'tool-output-available'; toolCallId: string }
              const found = toolCalls.find((t) => t.id === tc.toolCallId)
              if (found) {
                found.done = true
                updateAssistant(currentText, toolCalls)
              }
            } else if (chunk.type === 'error') {
              console.error('Chat stream error:', (chunk as { type: 'error'; errorText: string }).errorText)
            }
          }
        }

        setStatus('ready')
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Chat error:', err)
          setStatus('error')
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              id: assistantMsgId,
              role: 'assistant',
              text: 'Sorry, something went wrong. Please try again.',
              toolCalls: [],
            },
          ])
        }
      }
    },
    [messages, status, conversationId]
  )

  const isReadonlyHistory = !!conversationId && view === 'chat' && messages.length > 0 && status === 'ready'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex flex-col p-0 gap-0 w-[480px] sm:w-[520px] max-w-full"
        style={{ background: '#fcf9f2' }}
      >
        {/* Header */}
        <SheetHeader
          className="flex flex-row items-center justify-between px-4 py-3 shrink-0"
          style={{ background: '#eae8de' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {view === 'history' && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setView('chat')}
                className="h-7 w-7 shrink-0"
                title="Back to chat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Button>
            )}
            <SheetTitle className="text-sm font-semibold truncate">
              {view === 'history'
                ? 'Past conversations'
                : conversationTitle ?? 'Team AI'}
            </SheetTitle>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {view === 'chat' && (
              <>
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={reset}
                    className="h-7 px-2 text-xs text-muted-foreground"
                  >
                    New chat
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setView('history')}
                  className="h-7 w-7"
                  title="Past conversations"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M12 8v4l3 3" />
                    <path d="M3.05 11a9 9 0 1 1 .5 4" />
                    <path d="M3 16v-5h5" />
                  </svg>
                  <span className="sr-only">History</span>
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Body */}
        {view === 'history' ? (
          <ConversationHistory onSelect={loadConversation} />
        ) : loadingHistory ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: 'var(--color-muted-foreground)' }} />
              <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: 'var(--color-muted-foreground)' }} />
              <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-muted-foreground)' }} />
            </div>
          </div>
        ) : (
          <>
            <ChatMessageList messages={messages} isStreaming={status === 'streaming'} />
            <div className="shrink-0 p-3">
              <ChatInput onSubmit={sendMessage} disabled={status === 'streaming'} />
              <p className="text-center text-[10px] mt-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                {isReadonlyHistory
                  ? 'This is a past conversation — continue below or start a new chat'
                  : '⌘ Enter to send · Responses based on your interaction data'}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
