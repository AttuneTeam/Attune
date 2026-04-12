import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StrategiesListClient } from '@/components/strategies/StrategiesListClient'
import type { StrategicInitiative } from '@/lib/supabase/types'

export default async function StrategiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('strategic_initiatives')
    .select('*')
    .eq('manager_id', user.id)
    .order('updated_at', { ascending: false })

  return <StrategiesListClient initiatives={(data ?? []) as StrategicInitiative[]} />
}
