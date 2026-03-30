'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Team, TeamMember } from '@/lib/supabase/types'

interface Props {
  member: TeamMember
  teams: Team[]
}

const LEVELS = ['junior', 'mid', 'senior', 'staff', 'principal', 'director']

export function TeamMemberRowMenu({ member, teams }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Edit form state
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email ?? '')
  const [level, setLevel] = useState(member.level ?? '')
  const [roleDescription, setRoleDescription] = useState(member.role_description ?? '')
  const [startDate, setStartDate] = useState(member.start_date ?? '')
  const [skillsInput, setSkillsInput] = useState((member.skills ?? []).join(', '))
  const [teamId, setTeamId] = useState(member.team_id ?? '')

  const handleNewMeeting = async () => {
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }

    const { data, error } = await supabase
      .from('meetings')
      .insert({
        participant_id: member.id,
        manager_id: user.id,
        scheduled_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !data) {
      toast.error('Failed to create meeting')
      setCreating(false)
      return
    }
    router.push(`/meetings/${data.id}`)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    const skills = skillsInput.split(',').map((s) => s.trim()).filter(Boolean)

    startTransition(async () => {
      const { error } = await supabase
        .from('team_members')
        .update({
          name,
          email: email || null,
          level: level || null,
          role_description: roleDescription || null,
          start_date: startDate || null,
          skills,
          team_id: teamId || null,
        })
        .eq('id', member.id)
      if (error) { toast.error(error.message); return }
      toast.success('Team member updated')
      setEditOpen(false)
      router.refresh()
    })
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${member.name}? This will also delete all their meetings.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('team_members').delete().eq('id', member.id)
    if (error) { toast.error(error.message); return }
    toast.success('Team member deleted')
    setEditOpen(false)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleNewMeeting} disabled={creating}>
            <Plus className="h-4 w-4" />
            {creating ? 'Creating…' : 'New meeting'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit team member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="rm-name">Name *</Label>
                <Input id="rm-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rm-email">Email</Label>
                <Input id="rm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rm-level">Level</Label>
                <Select value={level} onValueChange={(v) => setLevel(v ?? '')}>
                  <SelectTrigger id="rm-level">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rm-start">Start date</Label>
                <Input id="rm-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rm-team">Team</Label>
                <Select value={teamId} onValueChange={(v) => setTeamId(v ?? '')}>
                  <SelectTrigger id="rm-team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No team</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="rm-role">Role description</Label>
                <Textarea id="rm-role" value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} rows={2} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="rm-skills">Skills (comma-separated)</Label>
                <Input id="rm-skills" value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="TypeScript, React, Go" />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
