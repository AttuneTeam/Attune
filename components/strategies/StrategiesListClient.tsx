'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { InitiativeCard } from './InitiativeCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2 } from 'lucide-react'
import type { StrategicInitiative } from '@/lib/supabase/types'

const ALL_STATUSES = ['active', 'paused', 'completed', 'archived'] as const

function getAllTags(initiatives: StrategicInitiative[]): string[] {
  const seen = new Set<string>()
  for (const ini of initiatives) {
    for (const tag of ini.tags) seen.add(tag)
  }
  return Array.from(seen).sort()
}

export function StrategiesListClient({ initiatives: initialInitiatives }: { initiatives: StrategicInitiative[] }) {
  const router = useRouter()
  const [initiatives, setInitiatives] = useState(initialInitiatives)
  const [creating, setCreating] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StrategicInitiative | null>(null)
  const [deleting, setDeleting] = useState(false)

  const allTags = getAllTags(initiatives)

  const filtered = initiatives.filter((ini) => {
    if (activeTag && !ini.tags.includes(activeTag)) return false
    if (activeStatus && ini.status !== activeStatus) return false
    return true
  })

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await fetch(`/api/strategies/${pendingDelete.id}`, { method: 'DELETE' })
    if (res.ok) {
      setInitiatives((prev) => prev.filter((i) => i.id !== pendingDelete.id))
      setPendingDelete(null)
    }
    setDeleting(false)
  }, [pendingDelete])

  const handleNew = useCallback(async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/strategies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (!res.ok) throw new Error('Failed')
      const { id } = await res.json()
      router.push(`/strategies/${id}`)
    } catch {
      setCreating(false)
    }
  }, [router])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Strategies</h1>
        <Button onClick={handleNew} disabled={creating} size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {creating ? 'Creating…' : 'New strategy'}
        </Button>
      </div>

      {/* Filters */}
      {(allTags.length > 0 || initiatives.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                activeTag === tag
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:text-foreground border-border hover:border-foreground/30'
              }`}
            >
              {tag}
            </button>
          ))}
          {allTags.length > 0 && <div className="w-px h-6 bg-border self-center" />}
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(activeStatus === s ? null : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                activeStatus === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:text-foreground border-border hover:border-foreground/30'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          {initiatives.length === 0 ? (
            <>
              <p className="text-muted-foreground mb-4">No strategies yet.</p>
              <p className="text-sm text-muted-foreground">
                Start by creating a new strategy or save one from an AI chat session.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No strategies match the selected filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {filtered.map((ini) => (
            <div key={ini.id} className="group relative">
              <InitiativeCard initiative={ini} />
              <button
                type="button"
                onClick={() => setPendingDelete(ini)}
                className="absolute top-3 right-3 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-muted"
                title="Delete strategy"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete strategy?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{pendingDelete?.title}</span> will be permanently deleted. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
