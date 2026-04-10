'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { format, isPast, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Check, Clock, Circle, ExternalLink, Trash2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'

const STATUS_CYCLE: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'done',
  done: 'open',
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

interface ActionItemRow {
  id: string
  description: string
  status: string
  due_date: string | null
  created_at: string
  interactions: {
    id: string
    scheduled_at: string
    team_members: { id: string; name: string } | null
  } | null
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'done') return <Check className="h-4 w-4 text-green-500" />
  if (status === 'in_progress') return <Clock className="h-4 w-4 text-amber-500" />
  return <Circle className="h-4 w-4 text-muted-foreground" />
}

export function ActionItemsTable({ items }: { items: ActionItemRow[] }) {
  const [localItems, setLocalItems] = useState(items)
  const [pendingDelete, setPendingDelete] = useState<ActionItemRow | null>(null)
  const [editingItem, setEditingItem] = useState<ActionItemRow | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const openEdit = (item: ActionItemRow) => {
    setEditingItem(item)
    setEditDescription(item.description)
    setEditDueDate(item.due_date ?? '')
    setEditStatus(item.status)
  }

  const saveEdit = async () => {
    if (!editingItem) return
    setSaving(true)
    const updates = {
      description: editDescription.trim(),
      due_date: editDueDate || null,
      status: editStatus,
    }
    setLocalItems((prev) =>
      prev.map((i) => i.id === editingItem.id ? { ...i, ...updates } : i)
    )
    setEditingItem(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('action_items')
      .update(updates)
      .eq('id', editingItem.id)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      setLocalItems(items)
    } else {
      router.refresh()
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const item = pendingDelete
    setPendingDelete(null)
    setLocalItems((prev) => prev.filter((i) => i.id !== item.id))
    const supabase = createClient()
    const { error } = await supabase
      .from('action_items')
      .delete()
      .eq('id', item.id)
    if (error) {
      toast.error(error.message)
      setLocalItems(items)
    } else {
      router.refresh()
    }
  }

  const cycleStatus = async (item: ActionItemRow) => {
    const newStatus = STATUS_CYCLE[item.status] ?? 'open'
    setLocalItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, status: newStatus } : i)
    )
    const supabase = createClient()
    const { error } = await supabase
      .from('action_items')
      .update({ status: newStatus })
      .eq('id', item.id)
    if (error) {
      toast.error(error.message)
      setLocalItems(items)
    } else {
      router.refresh()
    }
  }

  if (localItems.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No action items match this filter.
      </p>
    )
  }

  return (
    <>
      <ul className="space-y-2">
        {localItems.map((item) => {
          const overdue = item.status !== 'done' && item.due_date && isPast(parseISO(item.due_date))
          return (
            <li
              key={item.id}
              className={`rounded-lg border bg-card p-4 flex items-start gap-3 transition-opacity ${item.status === 'done' ? 'opacity-50' : ''}`}
            >
              <button
                onClick={() => cycleStatus(item)}
                className="mt-0.5 shrink-0 hover:opacity-70"
                title="Cycle status"
              >
                <StatusIcon status={item.status} />
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {item.description}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {item.interactions?.team_members?.name && (
                    <span className="text-xs text-muted-foreground">
                      {item.interactions.team_members.name}
                    </span>
                  )}
                  {item.due_date && (
                    <span className={`text-xs ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      Due {format(parseISO(item.due_date), 'MMM d, yyyy')}
                      {overdue ? ' ⚠' : ''}
                    </span>
                  )}
                  <Badge
                    variant={
                      item.status === 'done' ? 'secondary' :
                      item.status === 'in_progress' ? 'default' : 'outline'
                    }
                    className="text-xs capitalize"
                  >
                    {item.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {item.interactions?.id && (
                  <Link
                    href={`/interactions/${item.interactions.id}`}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="View interaction"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
                <button
                  onClick={() => openEdit(item)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Edit action item"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setPendingDelete(item)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                  title="Delete action item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Edit dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit action item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due date</label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditStatus(opt.value)}
                    className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium transition-colors ${
                      editStatus === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-accent border-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving || !editDescription.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete action item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingDelete?.description}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
