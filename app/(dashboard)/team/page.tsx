import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TeamMemberForm } from "@/components/team/TeamMemberForm";
import { TeamForm } from "@/components/team/TeamForm";
import { TeamMemberRowMenu } from "@/components/team/TeamMemberRowMenu";
import { OrgTree } from "@/components/team/OrgTree";
import { TeamCoverageCard } from "@/components/team/TeamCoverageCard";
import { formatTenure } from "@/lib/tenure";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: members } = await supabase
    .from("team_members")
    .select("*")
    .order("name");

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .order("name");

  const { data: teamValues } = await supabase
    .from("team_values")
    .select("*")
    .order("created_at");

  const { data: roles } = await supabase
    .from("roles")
    .select("*")
    .eq("manager_id", user.id)
    .order("title");

  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r]));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Team</h1>
        <div className="flex gap-2">
          <TeamForm teams={teams ?? []} managerId={user.id} />
          <TeamMemberForm
            teams={teams ?? []}
            roles={roles ?? []}
            managerId={user.id}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left: members table ── */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Team Members ({members?.length ?? 0})
          </h2>

          {!members || members.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No team members yet. Add your first direct report above.
            </p>
          ) : (
            <div className="rounded-lg bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Level
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Role
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Tenure
                    </th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-1 font-medium">
                        <Link
                          href={`/team/${member.id}`}
                          className="hover:underline underline-offset-2"
                        >
                          {member.name}
                        </Link>
                      </td>
                      <td className="px-4 py-1 text-muted-foreground capitalize">
                        {member.level ?? "—"}
                      </td>
                      <td className="px-4 py-1 text-muted-foreground max-w-xs truncate">
                        {member.role_id && roleMap[member.role_id]
                          ? roleMap[member.role_id].title
                          : (member.role_description ?? "—")}
                      </td>
                      <td className="px-4 py-1 text-muted-foreground tabular-nums">
                        {member.start_date
                          ? formatTenure(member.start_date)
                          : "—"}
                      </td>
                      <td className="px-4 py-1 text-right">
                        <TeamMemberRowMenu
                          member={member}
                          teams={teams ?? []}
                          roles={roles ?? []}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right: org structure + coverage ── */}
        <div className="space-y-6">
          {teams && teams.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Org Structure
              </h2>
              <OrgTree
                teams={teams}
                members={members ?? []}
                managerId={user.id}
                teamValues={teamValues ?? []}
              />
            </div>
          )}
          {members && members.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Insights
              </h2>
              <TeamCoverageCard />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
