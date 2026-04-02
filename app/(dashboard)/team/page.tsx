import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TeamMemberForm } from '@/components/team/TeamMemberForm'
import { TeamForm } from '@/components/team/TeamForm'
import { TeamMemberRowMenu } from '@/components/team/TeamMemberRowMenu'
import { OrgTree } from '@/components/team/OrgTree'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .order('name')

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('name')

  const { data: teamValues } = await supabase
    .from('team_values')
    .select('*')
    .order('created_at')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Team</h1>
        <div className="flex gap-2">
          <TeamForm teams={teams ?? []} managerId={user.id} />
          <TeamMemberForm teams={teams ?? []} managerId={user.id} />
        </div>
      </div>

      {/* Org tree */}
      {teams && teams.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Org Structure
          </h2>
          <OrgTree teams={teams} members={members ?? []} managerId={user.id} teamValues={teamValues ?? []} />
        </div>
      )}

      {/* Members table */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Team Members ({members?.length ?? 0})
      </h2>

      {!members || members.length === 0 ? (
        <p className="text-muted-foreground text-sm">No team members yet. Add your first direct report above.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Level</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Skills</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/team/${member.id}`} className="hover:underline underline-offset-2">
                      {member.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{member.level ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{member.role_description ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {member.start_date ? format(new Date(member.start_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(member.skills ?? []).slice(0, 3).map((skill: string) => (
                        <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <TeamMemberRowMenu member={member} teams={teams ?? []} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
