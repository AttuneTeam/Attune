import type { IntegrationProvider, ActivityItem } from './types'

// TODO: Implement Trello integration
// Requires: TRELLO_KEY + TRELLO_TOKEN env vars
// Approach: use the Trello REST API /members/{handle}/cards endpoint
// Docs: https://developer.atlassian.com/cloud/trello/rest/
export const trello: IntegrationProvider = {
  provider: 'trello',
  label: 'Trello',

  profileUrl(handle: string) {
    return `https://trello.com/${handle}`
  },

  async fetch(_handle: string, _config: Record<string, string>): Promise<ActivityItem[]> {
    return []
  },
}
