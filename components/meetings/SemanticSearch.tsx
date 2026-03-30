'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { format } from 'date-fns'

interface SearchResult {
  id: string
  interaction_id: string
  content: string
  similarity: number
  participant_name: string
  scheduled_at: string
}

export function SemanticSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[] | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults(null)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search interaction history…"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
        {results !== null && (
          <Button type="button" variant="outline" size="icon" onClick={clearSearch}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {results !== null && (
        <div className="rounded-lg border bg-card">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No results found.</p>
          ) : (
            <ul className="divide-y">
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/interactions/${r.interaction_id}`}
                    className="flex gap-3 p-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{r.participant_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.scheduled_at), 'MMM d, yyyy')}
                        </span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {(r.similarity * 100).toFixed(0)}% match
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{r.content}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
