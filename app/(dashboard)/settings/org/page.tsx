import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { OrgTree } from "@/components/team/OrgTree";
import { TeamForm } from "@/components/team/TeamForm";
import { TeamMemberForm } from "@/components/team/TeamMemberForm";
import { TeamMemberRowMenu } from "@/components/team/TeamMemberRowMenu";
import { formatTenure } from "@/lib/tenure";
import { OrgContextForm } from "@/components/settings/OrgContextForm";

export default async function OrganisationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: teams }, { data: members }, { data: teamValues }, { data: roles }, { data: orgContext }] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("team_members").select("*").order("name"),
      supabase.from("team_values").select("*").order("created_at"),
      supabase.from("roles").select("*").eq("manager_id", user.id).order("title"),
      supabase.from("org_context").select("*").eq("manager_id", user.id).maybeSingle(),
    ]);

  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r]));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Organisation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team structure, hierarchy, and members.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TeamForm teams={teams ?? []} managerId={user.id} />
          <TeamMemberForm
            teams={teams ?? []}
            roles={roles ?? []}
            managerId={user.id}
          />
        </div>
      </div>

      {/* Company Context */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Company Context</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            This information grounds AI analysis to your specific context — industry norms, how you work, and what your team does.
          </p>
        </div>
        <OrgContextForm initialData={orgContext ?? null} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Members table */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Members ({members?.length ?? 0})
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

        {/* Org tree */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Hierarchy
          </h2>
          {!teams || teams.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No teams yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a team above to build your hierarchy.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-4">
              <OrgTree
                teams={teams}
                members={members ?? []}
                managerId={user.id}
                teamValues={teamValues ?? []}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
