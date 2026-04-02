import { github } from './github'
import { slack } from './slack'
import { confluence } from './confluence'
import { trello } from './trello'
import { jira } from './jira'
import { cursor } from './cursor'
import type { IntegrationProvider, IntegrationResult } from './types'

const PROVIDERS: Record<string, IntegrationProvider> = {
  github,
  slack,
  confluence,
  trello,
  jira,
  cursor,
}

export async function fetchAllIntegrations(
  integrations: { provider: string; handle: string; config: Record<string, string> }[]
): Promise<IntegrationResult[]> {
  return Promise.all(
    integrations.map(async ({ provider, handle, config }) => {
      const p = PROVIDERS[provider]
      if (!p) {
        return { provider, label: provider, handle, profileUrl: '', items: [], error: 'Unknown provider' }
      }
      try {
        const items = await p.fetch(handle, config)
        return { provider, label: p.label, handle, profileUrl: p.profileUrl(handle), items }
      } catch {
        return { provider, label: p.label, handle, profileUrl: p.profileUrl(handle), items: [], error: 'Failed to load' }
      }
    })
  )
}

export { PROVIDERS }
export type { IntegrationResult, ActivityItem } from './types'
