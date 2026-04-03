import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RoleArea } from '@/lib/supabase/types'
import { RoleAreaReadOnly } from '@/components/roles/RoleAreaReadOnly'

export default async function MemberRolePage({
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

  const { data: member } = await supabase
    .from('team_members')
    .select('id, name, level, role_id')
    .eq('id', id)
    .single()

  if (!member) notFound()

  if (!member.role_id) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/team/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {member.name}
          </Link>
        </div>
        <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No role assigned to {member.name} yet.</p>
          <p className="text-xs text-muted-foreground">
            Assign a role by editing the member, or{' '}
            <Link href="/roles" className="underline underline-offset-2 hover:text-foreground">
              create a role first
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  const { data: role } = await supabase
    .from('roles')
    .select('id, title')
    .eq('id', member.role_id)
    .single()

  const { data: areasRaw } = await supabase
    .from('role_areas')
    .select('*')
    .eq('role_id', member.role_id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  const areas = (areasRaw ?? []) as RoleArea[]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/team/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          {member.name}
        </Link>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold truncate">{role?.title}</h1>
          {member.level && (
            <Badge variant="secondary" className="capitalize shrink-0">{member.level}</Badge>
          )}
        </div>
        <Link href={`/roles/${member.role_id}`}>
          <Button variant="outline" size="sm" className="shrink-0">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Edit role
          </Button>
        </Link>
      </div>

      {areas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No areas defined for this role yet.</p>
          <Link href={`/roles/${member.role_id}`} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground mt-1 inline-block">
            Add areas →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {areas.map((area) => (
            <RoleAreaReadOnly key={area.id} area={area} />
          ))}
        </div>
      )}
    </div>
  )
}
