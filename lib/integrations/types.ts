export type ActivityItem = {
  id: string
  title: string
  url: string
  status: string    // 'merged' | 'open' | 'closed' | 'published' | 'done' | etc.
  subtitle: string  // repo name, workspace, project, channel, etc.
  date: string      // ISO string
}

export type IntegrationResult = {
  provider: string
  label: string
  handle: string
  profileUrl: string
  items: ActivityItem[]
  error?: string
}

export interface IntegrationProvider {
  provider: string
  label: string
  fetch(handle: string, config: Record<string, string>): Promise<ActivityItem[]>
  profileUrl(handle: string): string
}
