import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { StrategyEditorClient } from '@/components/strategies/StrategyEditorClient'
import type { StrategicInitiative } from '@/lib/supabase/types'

export default async function InitiativeEditorPage({
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

  let parent: StrategicInitiative | null = null
  if (data.parent_id) {
    const { data: p } = await supabase
      .from('strategic_initiatives')
      .select('*')
      .eq('id', data.parent_id)
      .single()
    parent = (p ?? null) as StrategicInitiative | null
  }

  return (
    <StrategyEditorClient
      initiative={data as StrategicInitiative}
      parent={parent}
    />
  )
}
