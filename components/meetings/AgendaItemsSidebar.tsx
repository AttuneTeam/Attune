'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { Plus, CheckCircle, Circle, Trash2, ArrowRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import type { AgendaItem } from '@/lib/supabase/types'

interface Props {
  interactionId: string
  participantId: string
  items: AgendaItem[]
  onUpdate: () => void
}

export function AgendaItemsSidebar({ interactionId, participantId, items, onUpdate }: Props) {
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    const supabase = createClient()
    const { error } = await supabase.from('agenda_items').insert({
      interaction_id: interactionId,
      text: newText.trim(),
    })
    if (error) {
      toast.error(error.message)
    } else {
      setNewText('')
      onUpdate()
    }
    setAdding(false)
  }

  const toggleStatus = async (item: AgendaItem) => {
    const newStatus = item.status === 'open' ? 'discussed' : 'open'
    const supabase = createClient()
    const { error } = await supabase
      .from('agenda_items')
      .update({ status: newStatus })
      .eq('id', item.id)
    if (error) {
      toast.error(error.message)
    } else {
      onUpdate()
    }
  }

  const handleDelete = async (item: AgendaItem) => {
    const supabase = createClient()
    const { error } = await supabase.from('agenda_items').delete().eq('id', item.id)
    if (error) {
      toast.error(error.message)
    } else {
      onUpdate()
    }
  }

  const moveToNextMeeting = async (item: AgendaItem) => {
    const supabase = createClient()
    const { data: nextMeeting } = await supabase
      .from('interactions')
      .select('id, scheduled_at')
      .eq('participant_id', participantId)
      .eq('status', 'upcoming')
      .neq('id', interactionId)
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single()

    if (!nextMeeting) {
      toast.error('No upcoming meeting found for this person')
      return
    }

    const { error: insertError } = await supabase.from('agenda_items').insert({
      interaction_id: nextMeeting.id,
      text: item.text,
    })
    if (insertError) {
      toast.error(insertError.message)
      return
    }

    const { error: deleteError } = await supabase.from('agenda_items').delete().eq('id', item.id)
    if (deleteError) {
      toast.error(deleteError.message)
      return
    }

    toast.success(`Moved to ${format(parseISO(nextMeeting.scheduled_at), 'MMM d')}`)
    onUpdate()
  }

  const open = items.filter((i) => i.status === 'open')
  const discussed = items.filter((i) => i.status === 'discussed')
  const sorted = [...open, ...discussed]

  return (
    <div className="space-y-1">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No agenda items yet. Add one below.
        </p>
      ) : (
        sorted.map((item) => (
          <div
            key={item.id}
            className="group flex gap-2 items-start py-1"
          >
            <button
              type="button"
              onClick={() => toggleStatus(item)}
              className="mt-0.5 shrink-0 hover:opacity-70"
              title={item.status === 'discussed' ? 'Mark as open' : 'Mark as discussed'}
            >
              {item.status === 'discussed'
                ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            <span
              className={`text-xs flex-1 leading-relaxed ${
                item.status === 'discussed' ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {item.text}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {item.status === 'open' && (
                <button
                  type="button"
                  onClick={() => moveToNextMeeting(item)}
                  title="Move to next meeting"
                  className="hover:opacity-70"
                >
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(item)}
                title="Delete"
                className="hover:opacity-70"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          </div>
        ))
      )}

      <form onSubmit={handleAdd} className="flex gap-2 pt-2">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add agenda item…"
          className="text-xs h-7"
        />
        <Button type="submit" size="icon" className="h-7 w-7 shrink-0" disabled={adding}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  )
}
