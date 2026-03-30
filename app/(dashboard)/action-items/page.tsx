import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ActionItemsTable } from '@/components/ActionItemsTable'

export default async function ActionItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const statusFilter = params.status

  let query = supabase
    .from('action_items')
    .select(`
      id, description, status, due_date, created_at, assignee_id,
      meetings!inner (
        id, scheduled_at, manager_id,
        team_members (id, name)
      )
    `)
    .eq('meetings.manager_id', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (statusFilter && ['open', 'in_progress', 'done'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  const { data: items } = await query.limit(100)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Action Items</h1>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6">
        {[
          { label: 'All', value: undefined },
          { label: 'Open', value: 'open' },
          { label: 'In progress', value: 'in_progress' },
          { label: 'Done', value: 'done' },
        ].map(({ label, value }) => (
          <a
            key={label}
            href={value ? `/action-items?status=${value}` : '/action-items'}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === value || (!statusFilter && value === undefined)
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <ActionItemsTable items={(items ?? []) as never} />
    </div>
  )
}
