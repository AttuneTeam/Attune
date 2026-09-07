import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StrategiesListClient } from '@/components/strategies/StrategiesListClient'
import { fetchInitiatives } from '@/lib/initiatives/queries'

export default async function InitiativesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Scoped to kind = 'initiative': /map is the other lens over this table, and
  // without the filter every area captured there would appear here too.
  const initiatives = await fetchInitiatives(supabase, user.id)

  return <StrategiesListClient initiatives={initiatives} />
}
