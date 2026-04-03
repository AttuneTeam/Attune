'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RichTextInput } from '@/components/ui/RichTextInput'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import type { RoleArea, Json } from '@/lib/supabase/types'

// ── Individual area card ──────────────────────────────────────────────────────

interface AreaCardProps {
  area: RoleArea
  onDelete: (id: string) => void
}

function AreaCard({ area, onDelete }: AreaCardProps) {
  const [title, setTitle] = useState(area.title)
  const [descJson, setDescJson] = useState<Json | null>(area.description)
  const titleRef = useRef(title)
  titleRef.current = title
  const descRef = useRef(descJson)
  descRef.current = descJson
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function save() {
    const supabase = createClient()
    const { error } = await supabase
      .from('role_areas')
      .update({
        title: titleRef.current,
        description: descRef.current,
        updated_at: new Date().toISOString(),
      })
      .eq('id', area.id)
    if (error) toast.error('Failed to save: ' + error.message)
  }

  function handleDescChange(json: Json) {
    setDescJson(json)
    descRef.current = json
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(save, 1200)
  }

  function handleDelete() {
    if (!confirm(`Delete area "${titleRef.current || 'Untitled'}"?`)) return
    onDelete(area.id)
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3 group">
      <div className="flex items-start gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-2 shrink-0 cursor-grab" />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          placeholder="Area title, e.g. Platform and feature dev"
          className="flex-1 text-sm font-semibold bg-transparent border-0 outline-none ring-0 focus:ring-0 placeholder:text-muted-foreground/50 placeholder:font-normal"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="pl-7">
        <RichTextInput
          key={area.id}
          initialContent={descJson}
          onChange={handleDescChange}
          placeholder="Describe what this role involves in this area — responsibilities, scope, expectations…"
        />
      </div>
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface Props {
  roleId: string
  initialAreas: RoleArea[]
}

export function RoleAreasEditor({ roleId, initialAreas }: Props) {
  const [areas, setAreas] = useState<RoleArea[]>(initialAreas)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleAddArea() {
    startTransition(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('role_areas')
        .insert({
          role_id: roleId,
          title: '',
          description: null,
          display_order: areas.length,
        })
        .select()
        .single()

      if (error) { toast.error(error.message); return }
      setAreas((prev) => [...prev, data as RoleArea])
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('role_areas')
        .delete()
        .eq('id', id)
      if (error) { toast.error(error.message); return }
      setAreas((prev) => prev.filter((a) => a.id !== id))
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {areas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No areas defined yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add areas to describe what this role covers — responsibilities, scope, depth of expertise.
          </p>
        </div>
      ) : (
        areas.map((area) => (
          <AreaCard
            key={area.id}
            area={area}
            onDelete={handleDelete}
          />
        ))
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddArea}
        disabled={isPending}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        Add area
      </Button>
    </div>
  )
}
