'use client'

import type { Editor } from '@tiptap/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, List, HelpCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  editor: Editor | null
  meetingId: string
  onSummaryUpdate?: (summary: string, sentiment: number, themes: string[]) => void
  onActionItemsUpdate?: () => void
}

export function FloatingAIMenu({ meetingId, onSummaryUpdate, onActionItemsUpdate }: Props) {
  const [loading, setLoading] = useState<'summarize' | 'action-items' | 'coaching' | null>(null)
  const [coachingQuestions, setCoachingQuestions] = useState<string[]>([])
  const [showCoaching, setShowCoaching] = useState(false)

  const handleSummarize = async () => {
    setLoading('summarize')
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      onSummaryUpdate?.(data.summary, data.sentiment, data.keyThemes)
      toast.success('Summary generated')
    } catch {
      toast.error('Failed to summarize')
    } finally {
      setLoading(null)
    }
  }

  const handleExtractActionItems = async () => {
    setLoading('action-items')
    try {
      const res = await fetch('/api/ai/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      onActionItemsUpdate?.()
      toast.success(`${data.count} action item${data.count !== 1 ? 's' : ''} extracted`)
    } catch {
      toast.error('Failed to extract action items')
    } finally {
      setLoading(null)
    }
  }

  const handleCoachingQuestions = async () => {
    setLoading('coaching')
    try {
      const res = await fetch('/api/ai/coaching-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setCoachingQuestions(data.questions)
      setShowCoaching(true)
    } catch {
      toast.error('Failed to generate coaching questions')
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      {/* Always-visible AI actions toolbar (below the editor header) */}
      <div className="px-8 py-2 border-b flex gap-2 bg-muted/20">
        <span className="text-xs text-muted-foreground my-auto mr-1">AI Actions:</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={handleSummarize}
          disabled={loading !== null}
        >
          {loading === 'summarize' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Summarize
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={handleExtractActionItems}
          disabled={loading !== null}
        >
          {loading === 'action-items' ? <Loader2 className="h-3 w-3 animate-spin" /> : <List className="h-3 w-3" />}
          Extract items
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={handleCoachingQuestions}
          disabled={loading !== null}
        >
          {loading === 'coaching' ? <Loader2 className="h-3 w-3 animate-spin" /> : <HelpCircle className="h-3 w-3" />}
          Coaching Q&apos;s
        </Button>
      </div>

      {/* Coaching questions modal */}
      {showCoaching && coachingQuestions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-popover border rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="font-semibold mb-3">Suggested coaching questions</h3>
            <ul className="space-y-2">
              {coachingQuestions.map((q, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-5 w-full" variant="outline" onClick={() => setShowCoaching(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
