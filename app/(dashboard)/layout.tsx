import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import { Toaster } from '@/components/ui/sonner'
import { FloatingChatButton } from '@/components/chat/FloatingChatButton'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: members } = await supabase
    .from('team_members')
    .select('id, name')
    .order('name')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar profile={profile} members={members ?? []} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <FloatingChatButton />
      <Toaster />
    </div>
  )
}
