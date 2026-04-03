'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RichTextInput } from '@/components/ui/RichTextInput'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { MemberGoal, GoalTemplate, Json } from '@/lib/supabase/types'

// ── Period helpers ────────────────────────────────────────────────────────────

function currentPeriod(type: string): { year: number; period: number | null } {
  const now = new Date()
  const year = now.getFullYear()
  if (type === 'quarterly') return { year, period: Math.ceil((now.getMonth() + 1) / 3) }
  if (type === 'monthly') return { year, period: now.getMonth() + 1 }
  return { year, period: null }
}

function periodLabel(type: string, year: number, period: number | null): string {
  if (type === 'quarterly') return `Q${period} ${year}`
  if (type === 'monthly') {
    const d = new Date(year, (period as number) - 1, 1)
    return format(d, 'MMM yyyy')
  }
  return String(year)
}

function navigatePeriod(
  type: string,
  year: number,
  period: number | null,
  delta: -1 | 1,
): { year: number; period: number | null } {
  if (type === 'yearly') return { year: year + delta, period: null }
  if (type === 'quarterly') {
    let q = (period as number) + delta
    let y = year
    if (q < 1) { y--; q = 4 }
    if (q > 4) { y++; q = 1 }
    return { year: y, period: q }
  }
  // monthly
  let m = (period as number) + delta
  let y = year
  if (m < 1) { y--; m = 12 }
  if (m > 12) { y++; m = 1 }
  return { year: y, period: m }
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

function statusBadge(status: string) {
  if (status === 'completed') return { label: 'Completed', variant: 'default' as const }
  if (status === 'in_progress') return { label: 'In progress', variant: 'default' as const }
  if (status === 'archived') return { label: 'Archived', variant: 'secondary' as const }
  return { label: 'Not started', variant: 'outline' as const }
}

// ── Read-only rich text renderer ──────────────────────────────────────────────

function RichTextView({ content }: { content: Json }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Markdown.configure({ transformPastedText: true }),
    ],
    content: content as object,
  })
  if (!editor) return null
  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground [&_.tiptap]:outline-none"
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  memberId: string
  managerId: string
  initialGoals: MemberGoal[]
  templates: GoalTemplate[]
}

export function GoalsCard({ memberId, managerId, initialGoals, templates }: Props) {
  const [open, setOpen] = useState(false)
  const [periodType, setPeriodType] = useState<'yearly' | 'quarterly' | 'monthly'>('yearly')
  const [{ year, period }, setNav] = useState(() => currentPeriod('yearly'))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MemberGoal | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // form state
  const [title, setTitle] = useState('')
  const [descJson, setDescJson] = useState<Json | null>(null)
  const [status, setStatus] = useState('not_started')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  // update nav when period type changes
  function handlePeriodTypeChange(type: 'yearly' | 'quarterly' | 'monthly') {
    setPeriodType(type)
    setNav(currentPeriod(type))
  }

  const filteredGoals = initialGoals.filter(
    (g) => g.period_type === periodType && g.year === year && g.period === period,
  )

  const matchedTemplates = templates.filter(
    (t) => title.length > 0 && t.title.toLowerCase().includes(title.toLowerCase()),
  )

  function openAdd() {
    setEditing(null)
    setTitle('')
    setDescJson(null)
    setStatus('not_started')
    setDialogOpen(true)
  }

  function openEdit(g: MemberGoal) {
    setEditing(g)
    setTitle(g.title)
    setDescJson(g.description)
    setStatus(g.status)
    setDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    startTransition(async () => {
      if (editing) {
        const { error } = await supabase
          .from('member_goals')
          .update({ title, description: descJson, status, updated_at: new Date().toISOString() })
          .eq('id', editing.id)
        if (error) { toast.error(error.message); return }
        toast.success('Goal updated')
      } else {
        const { error } = await supabase
          .from('member_goals')
          .insert({ member_id: memberId, manager_id: managerId, period_type: periodType, year, period, title, description: descJson, status })
        if (error) { toast.error(error.message); return }
        toast.success('Goal added')
      }
      // upsert template if title is new
      const exists = templates.some((t) => t.title === title)
      if (!exists) {
        await supabase
          .from('goal_templates')
          .upsert({ manager_id: managerId, title }, { onConflict: 'manager_id,title' })
      }
      setDialogOpen(false)
      router.refresh()
    })
  }

  const handleDelete = (g: MemberGoal) => {
    if (!confirm(`Delete goal "${g.title}"?`)) return
    const supabase = createClient()
    startTransition(async () => {
      const { error } = await supabase.from('member_goals').delete().eq('id', g.id)
      if (error) { toast.error(error.message); return }
      toast.success('Goal deleted')
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header — always visible, click to collapse/expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <h2 className="text-sm font-semibold">Goals</h2>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
      {/* Controls */}
      <div className="px-5 pb-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          {/* Period type segmented control */}
          <div className="flex items-center rounded-md border text-xs overflow-hidden">
            {(['yearly', 'quarterly', 'monthly'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handlePeriodTypeChange(t)}
                className={`px-2.5 py-1 capitalize transition-colors ${
                  periodType === t
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{filteredGoals.length} goal{filteredGoals.length !== 1 ? 's' : ''}</span>
        </div>
        {/* Period navigator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNav((n) => navigatePeriod(periodType, n.year, n.period, -1))}
            className="rounded p-0.5 hover:bg-muted text-muted-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium tabular-nums min-w-[80px] text-center">
            {periodLabel(periodType, year, period)}
          </span>
          <button
            type="button"
            onClick={() => setNav((n) => navigatePeriod(periodType, n.year, n.period, 1))}
            className="rounded p-0.5 hover:bg-muted text-muted-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Goal list */}
      {filteredGoals.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">No goals for {periodLabel(periodType, year, period)}.</p>
        </div>
      ) : (
        <div className="divide-y">
          {filteredGoals.map((g) => {
            const badge = statusBadge(g.status)
            return (
              <div
                key={g.id}
                className={`px-5 py-3.5 flex items-start gap-3 ${g.status === 'archived' ? 'opacity-50' : ''}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{g.title}</p>
                    <Badge variant={badge.variant} className="text-xs shrink-0">{badge.label}</Badge>
                  </div>
                  {g.description && (
                    <RichTextView content={g.description} />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(g)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(g)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add goal */}
      <div className="px-5 py-3 border-t rounded-b-lg">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={
            <Button variant="outline" size="sm" className="w-full" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add goal
            </Button>
          } />
          <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit goal' : `Add goal — ${periodLabel(periodType, year, period)}`}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="overflow-y-auto flex-1 min-h-0 space-y-4 pt-1">
              {/* Title with template suggestions */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="goal-title">Title *</Label>
                <Input
                  id="goal-title"
                  ref={titleRef}
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="e.g. Strength to build on"
                  required
                  autoComplete="off"
                />
                {showSuggestions && matchedTemplates.length > 0 && (
                  <ul className="absolute z-50 w-full top-full mt-1 rounded-md border bg-popover shadow-md overflow-hidden text-sm">
                    {matchedTemplates.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={() => { setTitle(t.title); setShowSuggestions(false) }}
                        >
                          {t.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <RichTextInput
                  key={editing?.id ?? 'new'}
                  initialContent={descJson}
                  onChange={setDescJson}
                  placeholder="Add context, success criteria, notes…"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => { if (v) setStatus(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-1 pb-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? 'Saving…' : editing ? 'Save changes' : 'Add goal'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
        </>
      )}
    </div>
  )
}
