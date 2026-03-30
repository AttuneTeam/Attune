'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { Plus, Check, Clock, Circle, Pencil, Trash2 } from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'
import { toast } from 'sonner'
import type { ActionItem } from '@/lib/supabase/types'

const STATUS_CYCLE: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'done',
  done: 'open',
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'done') return <Check className="h-3.5 w-3.5 text-green-500" />
  if (status === 'in_progress') return <Clock className="h-3.5 w-3.5 text-amber-500" />
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />
}

interface Member { id: string; name: string }
interface Props {
  interactionId: string
  items: ActionItem[]
  allMembers: Member[]
  onUpdate: () => void
}

export function ActionItemsSidebar({ interactionId, items, allMembers, onUpdate }: Props) {
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingItem, setDeletingItem] = useState<ActionItem | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDesc.trim()) return
    setAdding(true)
    const supabase = createClient()
    const { error } = await supabase.from('action_items').insert({
      interaction_id: interactionId,
      description: newDesc.trim(),
    })
    if (error) {
      toast.error(error.message)
    } else {
      setNewDesc('')
      onUpdate()
    }
    setAdding(false)
  }

  const cycleStatus = async (item: ActionItem) => {
    const newStatus = STATUS_CYCLE[item.status] ?? 'open'
    const supabase = createClient()
    const { error } = await supabase
      .from('action_items')
      .update({ status: newStatus })
      .eq('id', item.id)
    if (error) {
      toast.error(error.message)
    } else {
      onUpdate()
    }
  }

  const startEdit = (item: ActionItem) => {
    setEditingItem(item)
    setEditingText(item.description)
  }

  const saveEdit = async () => {
    if (!editingItem) return
    const trimmed = editingText.trim()
    if (!trimmed) return
    const supabase = createClient()
    const { error } = await supabase
      .from('action_items')
      .update({ description: trimmed })
      .eq('id', editingItem.id)
    if (error) {
      toast.error(error.message)
    } else {
      setEditingItem(null)
      setEditingText('')
      onUpdate()
    }
  }

  const confirmDelete = async () => {
    if (!deletingItem) return
    const supabase = createClient()
    const { error } = await supabase.from('action_items').delete().eq('id', deletingItem.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Action item deleted')
      setDeletingItem(null)
      onUpdate()
    }
  }

  const open = items.filter((i) => i.status === 'open')
  const inProgress = items.filter((i) => i.status === 'in_progress')
  const done = items.filter((i) => i.status === 'done')

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Action Items</h2>
        <p className="text-xs text-muted-foreground">{open.length + inProgress.length} open</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No action items yet.<br />Use &ldquo;Extract items&rdquo; or add one below.
          </p>
        ) : (
          [...open, ...inProgress, ...done].map((item) => {
            const overdue = item.status !== 'done' && item.due_date && isPast(parseISO(item.due_date))
            return (
              <div
                key={item.id}
                className={`group flex gap-2 p-2 rounded-md hover:bg-accent/30 transition-colors ${
                  item.status === 'done' ? 'opacity-50' : ''
                }`}
              >
                <button
                  onClick={() => cycleStatus(item)}
                  className="mt-0.5 shrink-0 hover:opacity-70"
                  title={`Status: ${item.status}`}
                >
                  <StatusIcon status={item.status} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-relaxed ${item.status === 'done' ? 'line-through' : ''}`}>
                    {item.description}
                  </p>
                  {item.due_date && (
                    <p className={`text-xs mt-0.5 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Due {format(parseISO(item.due_date), 'MMM d')}
                      {overdue ? ' (overdue)' : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(item)} className="hover:opacity-70" title="Edit">
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeletingItem(item)} className="hover:opacity-70" title="Delete">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
                <Badge
                  variant={item.status === 'done' ? 'secondary' : item.status === 'in_progress' ? 'default' : 'outline'}
                  className="text-xs shrink-0 h-fit"
                >
                  {item.status.replace('_', ' ')}
                </Badge>
              </div>
            )
          })
        )}
      </div>

      {/* Add new */}
      <div className="border-t p-3">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Add action item…"
            className="text-xs h-8"
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={adding}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      {/* Edit modal */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) { setEditingItem(null); setEditingText('') } }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Edit action item</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit() }}
            rows={3}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={saveEdit} disabled={!editingText.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={!!deletingItem} onOpenChange={(open) => { if (!open) setDeletingItem(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete action item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{deletingItem?.description}</p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
