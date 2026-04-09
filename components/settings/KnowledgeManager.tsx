'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Trash2, FileText, Plus, X } from 'lucide-react'

type DocumentSummary = {
  id: string
  title: string
  source: string | null
  created_at: string
}

type Props = {
  initialDocuments: DocumentSummary[]
}

export function KnowledgeManager({ initialDocuments }: Props) {
  const [documents, setDocuments] = useState<DocumentSummary[]>(initialDocuments)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), source: source.trim() }),
      })

      if (!res.ok) throw new Error('Failed to save')

      const { id } = await res.json()
      setDocuments((prev) => [
        { id, title: title.trim(), source: source.trim() || null, created_at: new Date().toISOString() },
        ...prev,
      ])
      setTitle('')
      setContent('')
      setSource('')
      setShowForm(false)
      toast.success('Document added and being indexed')
    } catch {
      toast.error('Failed to save document')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error('Failed to delete')
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      toast.success('Document removed')
    } catch {
      toast.error('Failed to delete document')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add document
        </Button>
      )}

      {/* Upload form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--color-card)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">New document</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Engineering Career Ladder"
              required
              className="w-full rounded-lg px-3 py-2 text-sm bg-background border-0 outline-none ring-1 ring-border focus:ring-primary/50 transition-shadow"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Content
              <span className="ml-2 font-normal">Paste markdown, plain text, or copied web content</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the document content here…"
              required
              rows={10}
              className="w-full rounded-lg px-3 py-2 text-sm bg-background border-0 outline-none ring-1 ring-border focus:ring-primary/50 transition-shadow resize-y font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Source
              <span className="ml-2 font-normal">Optional — URL, filename, or description of origin</span>
            </label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. https://notion.so/…  or  Engineering Handbook v2.pdf"
              className="w-full rounded-lg px-3 py-2 text-sm bg-background border-0 outline-none ring-1 ring-border focus:ring-primary/50 transition-shadow"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving || !title.trim() || !content.trim()}>
              {saving ? 'Saving…' : 'Save & index'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Document list */}
      {documents.length === 0 && !showForm ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--color-card)' }}
        >
          <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm font-medium">No documents yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your career ladder, performance framework, or any reference material.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--color-card)' }}
            >
              <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.source ? (
                    <span className="truncate block max-w-xs">{doc.source}</span>
                  ) : null}
                  Added {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
