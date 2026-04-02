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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { TeamValue } from '@/lib/supabase/types'

interface Props {
  teamId: string
  teamName: string
  managerId: string
  values: TeamValue[]
}

export function TeamValuesForm({ teamId, teamName, managerId, values }: Props) {
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TeamValue | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keywordsRaw, setKeywordsRaw] = useState('')

  function openAdd() {
    setEditing(null)
    setName('')
    setDescription('')
    setKeywordsRaw('')
    setShowForm(true)
  }

  function openEdit(v: TeamValue) {
    setEditing(v)
    setName(v.name)
    setDescription(v.description ?? '')
    setKeywordsRaw(v.keywords.join(', '))
    setShowForm(true)
  }

  function closeForm() {
    setEditing(null)
    setName('')
    setDescription('')
    setKeywordsRaw('')
    setShowForm(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    const keywords = keywordsRaw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)

    startTransition(async () => {
      if (editing) {
        const { error } = await supabase
          .from('team_values')
          .update({ name, description: description || null, keywords })
          .eq('id', editing.id)
        if (error) { toast.error(error.message); return }
        toast.success('Value updated')
      } else {
        const { error } = await supabase
          .from('team_values')
          .insert({ team_id: teamId, manager_id: managerId, name, description: description || null, keywords })
        if (error) { toast.error(error.message); return }
        toast.success('Value added')
      }
      closeForm()
      router.refresh()
    })
  }

  const handleDelete = (v: TeamValue) => {
    if (!confirm(`Delete value "${v.name}"?`)) return
    const supabase = createClient()
    startTransition(async () => {
      const { error } = await supabase.from('team_values').delete().eq('id', v.id)
      if (error) { toast.error(error.message); return }
      toast.success('Value deleted')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Manage team values">
          <BookOpen className="h-3.5 w-3.5" />
        </Button>
      } />
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Team values — {teamName}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 space-y-3">

        {/* Existing values list */}
        {values.length > 0 && (
          <ul className="space-y-3 mt-2">
            {values.map((v) => (
              <li key={v.id} className="rounded-md border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm">{v.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(v)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(v)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {v.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>
                )}
                {v.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {v.keywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Add / Edit form */}
        {showForm ? (
          <form onSubmit={handleSave} className="space-y-3 border-t pt-4 mt-2">
            <p className="text-sm font-medium">{editing ? 'Edit value' : 'Add value'}</p>
            <div className="space-y-1.5">
              <Label htmlFor="value-name">Name *</Label>
              <Input
                id="value-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Craftsmanship"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="value-description">Description</Label>
              <Textarea
                id="value-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this value mean in practice?"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="value-keywords">Keywords <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
              <Input
                id="value-keywords"
                value={keywordsRaw}
                onChange={(e) => setKeywordsRaw(e.target.value)}
                placeholder="e.g. quality first, pragmatic, root cause"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? 'Saving...' : editing ? 'Save changes' : 'Add value'}
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add value
          </Button>
        )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
