import type { IntegrationProvider, ActivityItem } from './types'

const IMPORTANT_FIELDS = new Set(['status', 'resolution', 'assignee', 'priority', 'Sprint'])

async function jiraFetch(
  instance: string,
  path: string,
  auth: string,
  options: { method?: string; query?: Record<string, string | number>; body?: unknown } = {}
) {
  const url = new URL(path, instance)
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${options.method ?? 'GET'} ${url} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function fetchChangelog(instance: string, issueKey: string, auth: string): Promise<any[]> {
  const pageSize = 100
  let startAt = 0
  const histories: any[] = []
  for (let i = 0; i < 10; i++) {
    const data = await jiraFetch(instance, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/changelog`, auth, {
      query: { startAt, maxResults: pageSize },
    })
    const page: any[] = data?.values ?? []
    histories.push(...page)
    startAt += page.length
    if (data?.isLast === true || startAt >= (data?.total ?? 0) || page.length === 0) break
  }
  return histories
}

export const jira: IntegrationProvider = {
  provider: 'jira',
  label: 'Jira',

  profileUrl(_handle: string) {
    return ''
  },

  async fetch(accountId: string, config: Record<string, string>): Promise<ActivityItem[]> {
    const email = process.env.JIRA_EMAIL
    const token = process.env.JIRA_TOKEN
    const instance = config.instance?.replace(/\/$/, '')
    const project = config.project

    if (!email || !token || !instance || !project) {
      console.warn('[jira] skipping — JIRA_EMAIL, JIRA_TOKEN, config.instance or config.project not set')
      return []
    }

    const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
    const days = Number(config.days || 14)
    const limit = 20
    const jql = `project = "${project}" AND updated >= -${days}d ORDER BY updated DESC`

    console.log('[jira] fetching', { accountId, instance, project, jql })

    // Fetch recently updated issues in the project
    const issues: any[] = []
    let nextPageToken: string | undefined
    for (let i = 0; i < 5; i++) {
      const page = await jiraFetch(instance, '/rest/api/3/search/jql', auth, {
        method: 'POST',
        body: { jql, maxResults: 100, nextPageToken, fields: ['summary', 'updated'] },
      }).catch((err) => { console.error('[jira] search failed', err.message); return null })
      if (!page) break
      issues.push(...(page.issues ?? []))
      nextPageToken = page.nextPageToken
      if (!nextPageToken) break
    }

    // Walk changelogs concurrently, collecting actions by this user
    const actions: ActivityItem[] = []
    const concurrency = 5
    let idx = 0

    async function worker() {
      while (idx < issues.length && actions.length < limit * 4) {
        const issue = issues[idx++]
        if (!issue?.key) continue

        const histories = await fetchChangelog(instance, issue.key, auth).catch((err) => {
          console.error('[jira] changelog failed', issue.key, err.message)
          return []
        })

        for (const h of histories) {
          if (h?.author?.accountId !== accountId) continue
          const items: any[] = Array.isArray(h.items) ? h.items : []

          for (const it of items.filter((i: any) => IMPORTANT_FIELDS.has(i.field))) {
            const from = it.fromString ?? '(empty)'
            const to = it.toString ?? '(empty)'
            actions.push({
              id: `${issue.key}-${h.id}-${it.field}`,
              title: `[${issue.key}] ${issue.fields?.summary ?? ''}`,
              url: `${instance}/browse/${issue.key}`,
              status: it.field,
              subtitle: `${it.field}: ${from} → ${to}`,
              date: h.created,
            })
          }
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker))
    actions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return actions.slice(0, limit)
  },
}
