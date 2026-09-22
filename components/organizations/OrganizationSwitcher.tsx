'use client'

import { useEffect, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export type Organization = { id: string; name: string; archived_at?: string | null }

export function OrganizationSwitcher({ organizations, activeId }: { organizations: Organization[]; activeId: string | null }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  // Keep this boundary defensive so an archived row cannot appear if a caller
  // passes a stale or cached organisation list.
  const activeOrganizations = organizations.filter((organization) => !organization.archived_at)
  const active = activeOrganizations.find((organization) => organization.id === activeId) ?? activeOrganizations[0]
  const activeOrganizationId = active?.id

  useEffect(() => {
    if (!activeOrganizationId || activeOrganizationId === activeId) return
    void fetch('/api/organizations/active', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: activeOrganizationId }),
    }).then((response) => {
      if (response.ok) router.refresh()
    }).catch(() => undefined)
  }, [activeOrganizationId, activeId, router])

  async function select(organizationId: string) {
    const response = await fetch('/api/organizations/active', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId }),
    })
    if (!response.ok) return toast.error('Could not switch organisation.')
    router.refresh()
  }

  function create() {
    if (!name.trim()) return
    startTransition(async () => {
      const { data, error } = await createClient().rpc('create_organization', { organization_name: name.trim() })
      if (error || !data) {
        toast.error(error?.message ?? 'Could not create organisation.')
        return
      }
      await select(data.id)
      setName('')
      setCreating(false)
      toast.success('Organisation created')
    })
  }

  return (
    <div className="px-3 pb-3 border-b border-sidebar-border">
      <select aria-label="Active organisation" value={active?.id ?? ''} onChange={(event) => select(event.target.value)} className="w-full h-8 bg-transparent text-sm font-medium truncate outline-none">
        {activeOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
      </select>
      {creating ? (
        <div className="flex gap-1 mt-2"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && create()} placeholder="Organisation name" className="h-8 text-xs" /><Button size="sm" className="h-8" disabled={pending} onClick={create}>Add</Button></div>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus className="h-3 w-3" /> New organisation</button>
      )}
    </div>
  )
}
