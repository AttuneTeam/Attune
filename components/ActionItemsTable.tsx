'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  ActionItemEditDialog,
  type ActionItemUpdates,
} from '@/components/action-items/ActionItemEditDialog'

const STATUS_CYCLE: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'done',
  done: 'open',
}

interface ActionItemRow {
  id: string
  title: string | null
  description: string
  status: string
  due_date: string | null
  assignee_id: string | null
  created_at: string
  interactions: {
    id: string
    scheduled_at: string
    team_members: { id: string; name: string } | null
  } | null
}

interface Member {
  id: string
  name: string
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'done') return <Check className="h-4 w-4 text-green-500" />
  if (status === 'in_progress') return <Clock className="h-4 w-4 text-amber-500" />
  return <Circle className="h-4 w-4 text-muted-foreground" />
}

export function ActionItemsTable({ items, members = [] }: { items: ActionItemRow[]; members?: Member[] }) {
  const [localItems, setLocalItems] = useState(items)
  const [editingItem, setEditingItem] = useState<ActionItemRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ActionItemRow | null>(null)
  const router = useRouter()

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const handleSaveEdit = async (updates: ActionItemUpdates) => {
    if (!editingItem) return
    const id = editingItem.id
    setLocalItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
    )
    const supabase = createClient()
    const { error } = await supabase
      .from('action_items')
      .update(updates)
      .eq('id', id)
    if (error) {
      toast.error(error.message)
      setLocalItems(items)
    } else {
      setEditingItem(null)
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
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i))
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
          const done = item.status === 'done'
          const overdue = !done && item.due_date && isPast(parseISO(item.due_date))
          return (
            <li
              key={item.id}
              className={`rounded-lg border bg-card p-4 flex items-start gap-3 transition-opacity ${done ? 'opacity-50' : ''}`}
            >
              <button
                onClick={() => cycleStatus(item)}
                className="mt-0.5 shrink-0 hover:opacity-70"
                title="Cycle status"
              >
                <StatusIcon status={item.status} />
              </button>

              <div className="flex-1 min-w-0">
                {item.title ? (
                  <>
                    <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
                      {item.title}
                    </p>
                    <div className={`mt-0.5 text-xs text-muted-foreground prose prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:text-xs prose-p:text-muted-foreground prose-p:my-0 ${done ? 'line-through' : ''}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.description}</ReactMarkdown>
                    </div>
                  </>
                ) : (
                  <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {(item.assignee_id
                    ? members.find((m) => m.id === item.assignee_id)?.name
                    : item.interactions?.team_members?.name) && (
                    <span className="text-xs text-muted-foreground">
                      {item.assignee_id
                        ? members.find((m) => m.id === item.assignee_id)?.name
                        : item.interactions?.team_members?.name}
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
                  onClick={() => setEditingItem(item)}
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

      <ActionItemEditDialog
        key={editingItem?.id ?? 'none'}
        item={editingItem}
        members={members}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete action item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingDelete?.title ?? pendingDelete?.description}
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
