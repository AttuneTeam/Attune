import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ActionItemsTable } from '@/components/ActionItemsTable'
import { NewTaskButton } from '@/components/action-items/NewTaskButton'

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

  const [itemsResult, membersResult] = await Promise.all([
    (() => {
      let q = supabase
        .from('action_items')
        .select(`
          id, description, status, due_date, created_at, assignee_id,
          interactions!left (
            id, scheduled_at, manager_id,
            team_members (id, name)
          )
        `)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (statusFilter && ['open', 'in_progress', 'done'].includes(statusFilter)) {
        q = q.eq('status', statusFilter)
      }
      return q.limit(100)
    })(),
    supabase.from('team_members').select('id, name').order('name'),
  ])

  const items = itemsResult.data ?? []
  const members = membersResult.data ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Action Items</h1>
        <NewTaskButton userId={user.id} members={members} label="Add Action" />
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

      <ActionItemsTable items={items as never} members={members} />
    </div>
  )
}
