import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const organizationId = typeof document === 'undefined'
    ? undefined
    : document.cookie.split('; ').find((cookie) => cookie.startsWith('active-organization-id='))?.split('=')[1]

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: organizationId ? { 'x-organization-id': organizationId } : {},
      },
    },
  )
}
