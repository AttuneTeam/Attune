import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StrategiesListClient } from '@/components/strategies/StrategiesListClient'
import type { StrategicInitiative } from '@/lib/supabase/types'

export default async function InitiativesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('strategic_initiatives')
    .select('*')
    .eq('manager_id', user.id)
    .order('depth', { ascending: true })
    .order('created_at', { ascending: true })

  return <StrategiesListClient initiatives={(data ?? []) as StrategicInitiative[]} />
}
