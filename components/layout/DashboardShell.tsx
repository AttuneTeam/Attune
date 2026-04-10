'use client'

import { useState } from 'react'
import { ChatPanel } from '@/components/chat/ChatSheet'

type Props = {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export function DashboardShell({ sidebar, children }: Props) {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebar}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
        {chatOpen && (
          <ChatPanel onClose={() => setChatOpen(false)} />
        )}
      </div>
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full transition-shadow hover:shadow-lg"
          style={{
            background: 'rgba(255, 255, 255, 0.70)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0px 24px 48px rgba(56, 56, 49, 0.10)',
            color: 'var(--color-primary)',
            border: '1px solid rgba(65, 108, 99, 0.15)',
          }}
          title="Ask Team AI"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4 w-4 shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            />
          </svg>
          <span className="text-sm font-medium">Ask AI</span>
        </button>
      )}
    </div>
  )
}
