import type { Team, TeamMember, TeamValue } from '@/lib/supabase/types'
import { TeamForm } from './TeamForm'
import { TeamValuesForm } from './TeamValuesForm'

interface Props {
  teams: Team[]
  members: TeamMember[]
  managerId: string
  teamValues: TeamValue[]
  parentId?: string | null
  depth?: number
}

export function OrgTree({ teams, members, managerId, teamValues, parentId = null, depth = 0 }: Props) {
  const children = teams.filter((t) => t.parent_id === parentId)

  if (children.length === 0) return null

  return (
    <ul className={depth === 0 ? 'space-y-2' : 'ml-6 mt-2 space-y-2 border-l pl-4'}>
      {children.map((team) => {
        const teamMembers = members.filter((m) => m.team_id === team.id)
        const values = teamValues.filter((v) => v.team_id === team.id)
        return (
          <li key={team.id}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{team.name}</span>
              {teamMembers.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''})
                </span>
              )}
              <TeamForm teams={teams} managerId={managerId} existing={team} />
              <TeamValuesForm teamId={team.id} teamName={team.name} managerId={managerId} values={values} />
            </div>
            {teamMembers.length > 0 && (
              <div className="ml-4 mt-1 flex flex-wrap gap-1">
                {teamMembers.map((m) => (
                  <span key={m.id} className="text-xs bg-secondary text-secondary-foreground rounded px-2 py-0.5 capitalize">
                    {m.name}{m.level ? ` (${m.level})` : ''}
                  </span>
                ))}
              </div>
            )}
            <OrgTree teams={teams} members={members} managerId={managerId} teamValues={teamValues} parentId={team.id} depth={depth + 1} />
          </li>
        )
      })}
    </ul>
  )
}
