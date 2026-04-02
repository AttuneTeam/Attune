'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import type { ActivityItem } from '@/lib/integrations/types'

type Tab = 'events' | 'prs'

interface Props {
  handle: string
  repo?: string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  merged: 'default',
  released: 'default',
  opened: 'secondary',
  open: 'secondary',
  review: 'secondary',
  comment: 'secondary',
  push: 'secondary',
  created: 'secondary',
  closed: 'outline',
}

export function GitHubCard({ handle, repo }: Props) {
  const [tab, setTab] = useState<Tab>('events')
  const [cache, setCache] = useState<Partial<Record<Tab, ActivityItem[]>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (t: Tab) => {
    if (cache[t]) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ type: t, username: handle })
      if (repo) params.set('repo', repo)
      const res = await fetch(`/api/integrations/github?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch')
      setCache((prev) => ({ ...prev, [t]: data.items }))
    } catch (err: any) {
      setError(err.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [handle, repo, cache])

  // Load default tab on mount
  useEffect(() => { load('events') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (t: Tab) => {
    setTab(t)
    load(t)
  }

  const items = cache[tab]

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <h2 className="text-sm font-semibold">GitHub</h2>
        <a
          href={`https://github.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto flex items-center gap-1"
        >
          @{handle}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-0.5 bg-muted rounded-md w-fit">
        {(['events', 'prs'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'events' ? 'Activity' : 'Pull requests'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : !items || items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent activity found.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 10).map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              <Badge
                variant={STATUS_VARIANT[item.status] ?? 'outline'}
                className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5 capitalize"
              >
                {item.status}
              </Badge>
              <div className="flex-1 min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:underline underline-offset-2 line-clamp-1"
                >
                  {item.title}
                </a>
                <p className="text-muted-foreground truncate">
                  {item.subtitle} · {format(new Date(item.date), 'MMM d, yyyy')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
