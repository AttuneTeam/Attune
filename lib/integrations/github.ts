import type { IntegrationProvider, ActivityItem } from './types'

export const github: IntegrationProvider = {
  provider: 'github',
  label: 'GitHub',

  profileUrl(handle: string) {
    return `https://github.com/${handle}`
  },

  async fetch(handle: string, config: Record<string, string>): Promise<ActivityItem[]> {
    const token = process.env.GITHUB_TOKEN

    // config.repo accepts either "org" (e.g. "acme") or "owner/repo" (e.g. "acme/backend")
    let scopeFilter = ''
    if (config.repo) {
      scopeFilter = config.repo.includes('/')
        ? `+repo:${config.repo}`
        : `+org:${config.repo}`
    }

    const url = `https://api.github.com/search/issues?q=is:pr+author:${encodeURIComponent(handle)}${scopeFilter}&sort=created&order=desc&per_page=15`

    console.log('[github] fetching', { handle, url, hasToken: !!token, scopeFilter })

    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[github] request failed', { status: res.status, body })
      return []
    }

    const data = await res.json()
    const items: ActivityItem[] = []

    for (const item of data.items ?? []) {
      // html_url: https://github.com/owner/repo/pull/N
      const parts = (item.html_url as string).split('/')
      const subtitle = parts.length >= 5 ? `${parts[3]}/${parts[4]}` : ''
      const merged = !!(item.pull_request?.merged_at)
      const status = merged ? 'merged' : item.state === 'open' ? 'open' : 'closed'

      items.push({
        id: String(item.id),
        title: item.title,
        url: item.html_url,
        status,
        subtitle,
        date: item.created_at,
      })
    }

    return items
  },
}
