'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Role } from '@/lib/supabase/types'

interface Props {
  managerId: string
  existing?: Role
}

export function RoleForm({ managerId, existing }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function resetForm() {
    setTitle(existing?.title ?? '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    startTransition(async () => {
      if (existing) {
        const { error } = await supabase
          .from('roles')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) { toast.error(error.message); return }
        toast.success('Role updated')
        setOpen(false)
        router.refresh()
      } else {
        const { data, error } = await supabase
          .from('roles')
          .insert({ manager_id: managerId, title })
          .select('id')
          .single()
        if (error) { toast.error(error.message); return }
        setOpen(false)
        router.push(`/roles/${data.id}`)
      }
    })
  }

  const handleDelete = async () => {
    if (!existing) return
    if (!confirm(`Delete role "${existing.title}"? Team members assigned this role will be unassigned.`)) return
    const supabase = createClient()
    startTransition(async () => {
      const { error } = await supabase.from('roles').delete().eq('id', existing.id)
      if (error) { toast.error(error.message); return }
      toast.success('Role deleted')
      setOpen(false)
      router.push('/roles')
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger render={
        existing ? (
          <Button variant="outline" size="sm">Edit role title</Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New role
          </Button>
        )
      } />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit role' : 'New role'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-title">Title *</Label>
            <Input
              id="role-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid Frontend Developer"
              required
              autoFocus
            />
          </div>
          <div className="flex justify-between pt-1">
            {existing && (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : existing ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
