'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DescriptionEditor } from '@/components/action-items/DescriptionEditor'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

export interface ActionItemUpdates {
  title: string | null
  description: string
  due_date: string | null
  status: string
  assignee_id: string | null
}

export interface EditableActionItem {
  id: string
  title: string | null
  description: string
  status: string
  due_date: string | null
  assignee_id: string | null
}

interface Member {
  id: string
  name: string
}

interface Props {
  item: EditableActionItem | null
  members?: Member[]
  hideAssignee?: boolean
  onClose: () => void
  // onSave resolves when the DB operation completes (success or error handled by parent)
  onSave: (updates: ActionItemUpdates) => Promise<void>
}

// Mount this component with key={item?.id ?? 'none'} so state resets when the item changes.
export function ActionItemEditDialog({ item, members = [], hideAssignee = false, onClose, onSave }: Props) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [dueDate, setDueDate] = useState(item?.due_date ?? '')
  const [status, setStatus] = useState(item?.status ?? 'open')
  const [assigneeId, setAssigneeId] = useState(item?.assignee_id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!description.trim() || !item) return
    setSaving(true)
    await onSave({
      title: title.trim() || null,
      description: description.trim(),
      due_date: dueDate || null,
      status,
      assignee_id: assigneeId || null,
    })
    setSaving(false)
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit action item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Title (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short title…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Description
            </label>
            {item && (
              <DescriptionEditor
                key={item.id}
                initialValue={description}
                onChange={setDescription}
                placeholder="What needs to be done?"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Due date
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {members.length > 0 && !hideAssignee && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Person
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Me</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium transition-colors ${
                    status === opt.value
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !description.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
