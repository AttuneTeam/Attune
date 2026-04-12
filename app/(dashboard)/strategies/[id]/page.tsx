import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { StrategyEditorClient } from '@/components/strategies/StrategyEditorClient'
import type { StrategicInitiative } from '@/lib/supabase/types'

export default async function StrategyEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('strategic_initiatives')
    .select('*')
    .eq('id', id)
    .eq('manager_id', user.id)
    .single()

  if (!data) notFound()

  return <StrategyEditorClient initiative={data as StrategicInitiative} />
}
