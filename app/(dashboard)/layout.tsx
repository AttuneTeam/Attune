import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import { Toaster } from '@/components/ui/sonner'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Ensure profile exists (idempotent upsert)
  await supabase.from('profiles').upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
    role: 'manager',
  }, { onConflict: 'id', ignoreDuplicates: true })

  const { data: memberships } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
  const organizationIds = (memberships ?? []).map((membership: { organization_id: string }) => membership.organization_id)
  const { data: organizations } = organizationIds.length
    ? await supabase.from('organizations').select('id, name, archived_at').in('id', organizationIds).is('archived_at', null).order('created_at')
    : { data: [] }

  const [{ data: profile }, { data: members }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('team_members').select('id, name, relationship').order('name'),
  ])

  const cookieStore = await cookies()
  const sidebarCollapsed = cookieStore.get('sidebar-collapsed')?.value === 'true'

  return (
    <>
      <DashboardShell sidebar={<Sidebar profile={profile} members={members ?? []} organizations={organizations ?? []} activeOrganizationId={cookieStore.get('active-organization-id')?.value ?? null} defaultCollapsed={sidebarCollapsed} />}>
        {children}
      </DashboardShell>
      <Toaster />
    </>
  )
}
