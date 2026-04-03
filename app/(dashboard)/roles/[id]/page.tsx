import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RoleAreasEditor } from '@/components/team/RoleAreasEditor'
import { RoleForm } from '@/components/roles/RoleForm'
import type { RoleArea } from '@/lib/supabase/types'

export default async function RoleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: role } = await supabase
    .from('roles')
    .select('*')
    .eq('id', id)
    .single()

  if (!role) notFound()

  const { data: areasRaw } = await supabase
    .from('role_areas')
    .select('*')
    .eq('role_id', id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  const areas = (areasRaw ?? []) as RoleArea[]

  // Members assigned to this role
  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, level')
    .eq('role_id', id)
    .order('name')

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/roles"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Roles
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{role.title}</h1>
        </div>
        <RoleForm managerId={user.id} existing={role} />
      </div>

      {/* Areas editor */}
      <RoleAreasEditor roleId={id} initialAreas={areas} />

      {/* Members with this role */}
      {members && members.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Members with this role
          </p>
          <div className="rounded-lg border divide-y overflow-hidden">
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/team/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-sm"
              >
                <span className="flex-1 font-medium">{m.name}</span>
                {m.level && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {m.level}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
