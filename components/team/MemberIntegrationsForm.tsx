'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Plug } from 'lucide-react'
import { toast } from 'sonner'
import type { MemberIntegration } from '@/lib/supabase/types'

type ProviderConfig = {
  key: string
  label: string
  placeholder: string
  hint: string
  configFields?: { key: string; label: string; placeholder: string; hint: string }[]
}

const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    key: 'github',
    label: 'GitHub',
    placeholder: 'e.g. torvalds',
    hint: 'GitHub username',
    configFields: [
      {
        key: 'repo',
        label: 'Org or repo filter',
        placeholder: 'e.g. acme  or  acme/backend',
        hint: 'Leave blank to search all repos',
      },
    ],
  },
  {
    key: 'jira',
    label: 'Jira',
    placeholder: 'e.g. 557058:f3c32...',
    hint: 'Jira account ID (from profile URL)',
    configFields: [
      {
        key: 'instance',
        label: 'Instance URL',
        placeholder: 'e.g. https://acme.atlassian.net',
        hint: 'Jira workspace URL',
      },
      {
        key: 'project',
        label: 'Project key',
        placeholder: 'e.g. ENG or PLATFORM',
        hint: 'JQL project to scope activity to',
      },
    ],
  },
  { key: 'cursor', label: 'Cursor', placeholder: 'e.g. alice@acme.com', hint: 'Work email used in Cursor' },
  { key: 'slack', label: 'Slack', placeholder: 'e.g. U012AB3CD', hint: 'Slack member ID' },
  { key: 'confluence', label: 'Confluence', placeholder: 'e.g. 557058:abc123', hint: 'Atlassian account ID' },
  { key: 'trello', label: 'Trello', placeholder: 'e.g. torvalds', hint: 'Trello username' },
]

interface Props {
  memberId: string
  managerId: string
  integrations: MemberIntegration[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function MemberIntegrationsForm({ memberId, managerId, integrations, open: controlledOpen, onOpenChange: controlledOnOpenChange }: Props) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function buildInitialState() {
    const handles: Record<string, string> = {}
    const configs: Record<string, Record<string, string>> = {}
    for (const p of SUPPORTED_PROVIDERS) {
      const existing = integrations.find((i) => i.provider === p.key)
      handles[p.key] = existing?.handle ?? ''
      configs[p.key] = existing?.config ?? {}
    }
    return { handles, configs }
  }

  const [handles, setHandles] = useState<Record<string, string>>(buildInitialState().handles)
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>(buildInitialState().configs)

  const open = isControlled ? controlledOpen! : internalOpen

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const init = buildInitialState()
      setHandles(init.handles)
      setConfigs(init.configs)
    }
    if (isControlled) controlledOnOpenChange!(next)
    else setInternalOpen(next)
  }

  const setConfigField = (provider: string, field: string, value: string) => {
    setConfigs((prev) => ({ ...prev, [provider]: { ...prev[provider], [field]: value } }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()

    startTransition(async () => {
      for (const { key } of SUPPORTED_PROVIDERS) {
        const handle = handles[key]?.trim() ?? ''
        const config = Object.fromEntries(
          Object.entries(configs[key] ?? {}).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== '')
        )
        const existing = integrations.find((i) => i.provider === key)

        if (handle && !existing) {
          const { error } = await supabase.from('team_member_integrations').insert({
            member_id: memberId,
            manager_id: managerId,
            provider: key,
            handle,
            config,
          })
          if (error) { toast.error(`${key}: ${error.message}`); return }
        } else if (handle && existing) {
          const { error } = await supabase
            .from('team_member_integrations')
            .update({ handle, config })
            .eq('id', existing.id)
          if (error) { toast.error(`${key}: ${error.message}`); return }
        } else if (!handle && existing) {
          const { error } = await supabase
            .from('team_member_integrations')
            .delete()
            .eq('id', existing.id)
          if (error) { toast.error(`${key}: ${error.message}`); return }
        }
      }

      toast.success('Integrations saved')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger render={
          <Button variant="outline" size="sm">
            <Plug className="h-3.5 w-3.5 mr-1.5" />
            Integrations
          </Button>
        } />
      )}
      <DialogContent className="max-w-sm flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage integrations</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="overflow-y-auto flex-1 min-h-0 space-y-5 mt-1 pr-0.5">
          {SUPPORTED_PROVIDERS.map(({ key, label, placeholder, hint, configFields }) => (
            <div key={key} className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor={`integration-${key}`}>
                  {label}
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">{hint}</span>
                </Label>
                <Input
                  id={`integration-${key}`}
                  value={handles[key] ?? ''}
                  onChange={(e) => setHandles((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                />
              </div>
              {configFields?.map((field) => (
                <div key={field.key} className="space-y-1.5 pl-3 border-l ml-1">
                  <Label htmlFor={`integration-${key}-${field.key}`} className="text-muted-foreground">
                    {field.label}
                    <span className="ml-1.5 text-xs font-normal">{field.hint}</span>
                  </Label>
                  <Input
                    id={`integration-${key}-${field.key}`}
                    value={configs[key]?.[field.key] ?? ''}
                    onChange={(e) => setConfigField(key, field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2 pb-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
