import type { IntegrationProvider, ActivityItem } from './types'

const SLACK_API = 'https://slack.com/api'

function authHeaders() {
  return { Authorization: `Bearer ${process.env.SLACK_TOKEN}` }
}

/** Monday of the week containing `date` (local time, UTC midnight). */
function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function toSlackDate(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

async function fetchMessageCount(
  memberId: string,
  after: Date,
  before: Date,
): Promise<number> {
  const query = `from:<@${memberId}> after:${toSlackDate(after)} before:${toSlackDate(before)}`
  const url = `${SLACK_API}/search.messages?` +
    new URLSearchParams({ query, count: '1', highlight: 'false' })
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) return 0
  const data = await res.json()
  if (!data.ok) return 0
  return (data.messages?.paging?.total as number) ?? 0
}

export const slack: IntegrationProvider = {
  provider: 'slack',
  label: 'Slack',

  profileUrl(handle: string) {
    return `https://slack.com/team/${handle}`
  },

  async fetch(handle: string, _config: Record<string, string>): Promise<ActivityItem[]> {
    if (!process.env.SLACK_TOKEN) return []

    const items: ActivityItem[] = []
    const profileUrl = `https://slack.com/team/${handle}`

    // ── Status + Presence ────────────────────────────────────────────────────
    try {
      const [infoRes, presenceRes] = await Promise.all([
        fetch(`${SLACK_API}/users.info?user=${handle}`, { headers: authHeaders() }),
        fetch(`${SLACK_API}/users.getPresence?user=${handle}`, { headers: authHeaders() }),
      ])

      const infoData = await infoRes.json()
      const presenceData = await presenceRes.json()

      if (infoData.error === 'user_not_found') return []

      const profile = infoData.user?.profile ?? {}
      const statusEmoji: string = profile.status_emoji ?? ''
      const statusText: string = profile.status_text ?? ''
      const presence: string = presenceData.presence ?? 'away'

      const statusTitle = statusText
        ? `${statusEmoji} ${statusText}`.trim()
        : 'No status set'

      items.push({
        id: `slack-status-${handle}`,
        title: statusTitle,
        url: profileUrl,
        status: 'status',
        subtitle: presence === 'active' ? 'Active' : 'Away',
        date: new Date().toISOString(),
      })
    } catch {
      // If status fetch fails, continue to activity
    }

    // ── Message frequency trend ───────────────────────────────────────────────
    try {
      const now = new Date()
      const thisWeekStart = mondayOf(now)
      const lastWeekStart = mondayOf(new Date(thisWeekStart.getTime() - 24 * 60 * 60 * 1000))
      const tomorrow = new Date(now)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

      const [thisWeek, lastWeek] = await Promise.all([
        fetchMessageCount(handle, thisWeekStart, tomorrow),
        fetchMessageCount(handle, lastWeekStart, thisWeekStart),
      ])

      if (thisWeek > 0 || lastWeek > 0) {
        const diff = thisWeek - lastWeek
        let subtitle: string
        if (diff > 0) {
          subtitle = `↑${diff} from last week (${lastWeek})`
        } else if (diff < 0) {
          subtitle = `↓${Math.abs(diff)} from last week (${lastWeek})`
        } else {
          subtitle = lastWeek > 0 ? `Same as last week (${lastWeek})` : 'First activity this week'
        }

        items.push({
          id: `slack-activity-${handle}`,
          title: thisWeek === 0
            ? 'No messages this week'
            : `${thisWeek} message${thisWeek === 1 ? '' : 's'} this week`,
          url: profileUrl,
          status: 'published',
          subtitle,
          date: new Date().toISOString(),
        })
      }
    } catch {
      // Activity fetch failed — status item still returned above
    }

    return items
  },
}
