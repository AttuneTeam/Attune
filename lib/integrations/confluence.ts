import type { IntegrationProvider, ActivityItem } from './types'

// TODO: Implement Confluence integration
// Requires: CONFLUENCE_TOKEN (Atlassian API token) + CONFLUENCE_BASE_URL env vars
// Approach: use the Confluence REST API v2 /pages endpoint filtered by author accountId
// Docs: https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
export const confluence: IntegrationProvider = {
  provider: 'confluence',
  label: 'Confluence',

  profileUrl(handle: string) {
    const base = process.env.CONFLUENCE_BASE_URL ?? 'https://confluence.atlassian.com'
    return `${base}/wiki/people/${handle}`
  },

  async fetch(_handle: string, _config: Record<string, string>): Promise<ActivityItem[]> {
    return []
  },
}
