import type { IntegrationProvider, ActivityItem } from './types'

// TODO: Implement Slack integration
// Requires: SLACK_TOKEN env var (bot token with users:read and search:read scopes)
// Approach: use the Slack Web API search.messages endpoint filtered by user
// Docs: https://api.slack.com/methods/search.messages
export const slack: IntegrationProvider = {
  provider: 'slack',
  label: 'Slack',

  profileUrl(handle: string) {
    // handle is the Slack member ID (e.g. U012AB3CD)
    return `https://slack.com/team/${handle}`
  },

  async fetch(_handle: string, _config: Record<string, string>): Promise<ActivityItem[]> {
    return []
  },
}
