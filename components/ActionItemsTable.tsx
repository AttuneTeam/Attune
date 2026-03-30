'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { format, isPast, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Check, Clock, Circle, ExternalLink } from 'lucide-react'
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
  meetings: {
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
  const router = useRouter()

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
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8"></th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Person</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due date</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {localItems.map((item) => {
            const overdue = item.status !== 'done' && item.due_date && isPast(parseISO(item.due_date))
            return (
              <tr
                key={item.id}
                className={`hover:bg-muted/30 ${item.status === 'done' ? 'opacity-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <button onClick={() => cycleStatus(item)} className="hover:opacity-70">
                    <StatusIcon status={item.status} />
                  </button>
                </td>
                <td className={`px-4 py-3 ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {item.description}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.meetings?.team_members?.name ?? '—'}
                </td>
                <td className={`px-4 py-3 ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {item.due_date ? format(parseISO(item.due_date), 'MMM d, yyyy') : '—'}
                  {overdue ? ' ⚠' : ''}
                </td>
                <td className="px-4 py-3">
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
                <td className="px-4 py-3">
                  {item.meetings?.id && (
                    <Link
                      href={`/meetings/${item.meetings.id}`}
                      className="text-muted-foreground hover:text-foreground"
                      title="View meeting"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
