'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
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
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { DescriptionEditor } from '@/components/action-items/DescriptionEditor'

interface Member {
  id: string
  name: string
}

export function NewTaskButton({
  userId,
  members = [],
  label = 'New task',
}: {
  userId: string
  members?: Member[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setDueDate('')
    setAssigneeId('')
  }

  const handleSave = async () => {
    const trimmedDesc = description.trim()
    if (!trimmedDesc) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('action_items').insert({
      user_id: userId,
      title: title.trim() || null,
      description: trimmedDesc,
      status: 'open',
      due_date: dueDate || null,
      assignee_id: assigneeId || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Action created')
      setOpen(false)
      resetForm()
      router.refresh()
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) resetForm()
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New action</DialogTitle>
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
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Description
              </label>
              {open && (
                <DescriptionEditor
                  key="new-task"
                  initialValue={description}
                  onChange={setDescription}
                  placeholder="What needs to be done?"
                />
              )}
            </div>
            {members.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Person (optional)
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">No one</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Due date (optional)
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !description.trim()}>
              {saving ? 'Saving…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
