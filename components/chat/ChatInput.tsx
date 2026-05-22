'use client'

import { useRef, useState } from 'react'

type SuggestedPrompt = {
  label: string
  prompt: string
}

type Props = {
  onSubmit: (text: string) => void
  disabled?: boolean
  suggestedPrompts?: SuggestedPrompt[]
}

export function ChatInput({ onSubmit, disabled, suggestedPrompts }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSubmit(text)
    setValue('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // Auto-grow textarea
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  const showChips = !disabled && !!suggestedPrompts?.length && !value.trim()

  return (
    <div className="flex flex-col gap-1.5">
      {showChips && (
        <div className="flex flex-wrap gap-1.5">
          {suggestedPrompts!.map((sp) => (
            <button
              key={sp.label}
              type="button"
              onClick={() => onSubmit(sp.prompt)}
              className="text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{
                background: 'var(--color-background)',
                borderColor: 'rgba(65,108,99,0.25)',
                color: 'var(--color-primary)',
              }}
            >
              {sp.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="flex items-end gap-2 p-3 rounded-xl"
        style={{ background: 'var(--color-accent)' }}
      >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about your team…"
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        style={{ maxHeight: '160px', overflowY: 'auto' }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim() || disabled}
        className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-40"
        title="Send (⌘ Enter)"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))',
          color: 'var(--color-primary-foreground)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22 11 13 2 9l20-7z" />
        </svg>
      </button>
      </div>
    </div>
  )
}
