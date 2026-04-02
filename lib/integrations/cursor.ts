import type { IntegrationProvider, ActivityItem } from './types'

export const cursor: IntegrationProvider = {
  provider: 'cursor',
  label: 'Cursor',

  profileUrl(_handle: string) {
    return ''
  },

  async fetch(email: string, config: Record<string, string>): Promise<ActivityItem[]> {
    const apiKey = process.env.CURSOR_API_KEY
    if (!apiKey) {
      console.warn('[cursor] skipping — CURSOR_API_KEY not set')
      return []
    }

    const days = config.days || '14'
    const pageSize = 50
    const auth = Buffer.from(`${apiKey}:`).toString('base64')

    const url = new URL('https://api.cursor.com/analytics/ai-code/commits')
    url.searchParams.set('startDate', `${days}d`)
    url.searchParams.set('endDate', 'now')
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', String(pageSize))
    url.searchParams.set('user', email)

    console.log('[cursor] fetching', { email, days })

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      next: { revalidate: 1800 },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[cursor] failed', { status: res.status, body })
      return []
    }

    const data = await res.json()
    const commits: any[] = Array.isArray(data) ? data : (data.commits ?? data.data ?? [])

    return commits.map((c): ActivityItem => {
      const aiLines = (c.tabLinesAdded ?? 0) + (c.composerLinesAdded ?? 0)
      const totalAdded = c.totalLinesAdded ?? 0
      const aiPercent = totalAdded > 0 ? Math.round((aiLines / totalAdded) * 100) : 0
      const parts: string[] = []
      if (c.repoName) parts.push(c.repoName)
      if (aiLines > 0) parts.push(`${aiPercent}% AI (${aiLines} lines)`)

      return {
        id: c.commitHash ?? String(c.createdAt),
        title: c.message ?? 'Commit',
        url: '',
        status: aiLines > 0 ? 'ai-assisted' : 'manual',
        subtitle: parts.join(' · '),
        date: c.commitTs ?? c.createdAt ?? '',
      }
    })
  },
}
