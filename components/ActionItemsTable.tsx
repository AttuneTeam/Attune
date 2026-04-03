'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { format, isPast, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Check, Clock, Circle, ExternalLink, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const STATUS_CYCLE: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'done',
  done: 'open',
}

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
  const router = useRouter()

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
      setLocalItems(items) // revert
    } else {
      router.refresh()
    }
  }

  const cycleStatus = async (item: ActionItemRow) => {
    const newStatus = STATUS_CYCLE[item.status] ?? 'open'
    // Optimistic update
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
      setLocalItems(items) // revert
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
    <div className="rounded-lg bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-4 py-2 w-8"></th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Description</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Person</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Due date</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
            <th className="px-4 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {localItems.map((item) => {
            const overdue = item.status !== 'done' && item.due_date && isPast(parseISO(item.due_date))
            return (
              <tr
                key={item.id}
                className={`hover:bg-muted/50 transition-colors ${item.status === 'done' ? 'opacity-50' : ''}`}
              >
                <td className="px-4 py-2">
                  <button onClick={() => cycleStatus(item)} className="hover:opacity-70">
                    <StatusIcon status={item.status} />
                  </button>
                </td>
                <td className={`px-4 py-2 ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {item.description}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {item.interactions?.team_members?.name ?? '—'}
                </td>
                <td className={`px-4 py-2 ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {item.due_date ? format(parseISO(item.due_date), 'MMM d, yyyy') : '—'}
                  {overdue ? ' ⚠' : ''}
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={
                      item.status === 'done' ? 'secondary' :
                      item.status === 'in_progress' ? 'default' : 'outline'
                    }
                    className="text-xs capitalize"
                  >
                    {item.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {item.interactions?.id && (
                      <Link
                        href={`/interactions/${item.interactions.id}`}
                        className="text-muted-foreground hover:text-foreground"
                        title="View interaction"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <button
                      onClick={() => setPendingDelete(item)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete action item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete action item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingDelete?.description}
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
