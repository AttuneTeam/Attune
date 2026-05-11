import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RoleForm } from "@/components/roles/RoleForm";
import { ChevronRight } from "lucide-react";

export default async function RolesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roles } = await supabase
    .from("roles")
    .select("*")
    .eq("manager_id", user.id)
    .order("title");

  // Count areas per role
  const roleIds = (roles ?? []).map((r) => r.id);
  const { data: areaCounts } = roleIds.length
    ? await supabase.from("role_areas").select("role_id").in("role_id", roleIds)
    : { data: [] };

  // Count members per role
  const { data: memberCounts } = roleIds.length
    ? await supabase
        .from("team_members")
        .select("role_id")
        .in("role_id", roleIds)
    : { data: [] };

  const areaCountMap: Record<string, number> = {};
  const memberCountMap: Record<string, number> = {};
  for (const row of areaCounts ?? []) {
    areaCountMap[row.role_id] = (areaCountMap[row.role_id] ?? 0) + 1;
  }
  for (const row of memberCounts ?? []) {
    if (row.role_id)
      memberCountMap[row.role_id] = (memberCountMap[row.role_id] ?? 0) + 1;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define generic role descriptions. Assign them to team members to
            build a shared picture of team capability.
          </p>
        </div>
        <RoleForm managerId={user.id} />
      </div>

      {!roles || roles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No roles defined yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a role (e.g. "Senior Account Executive") and define its areas
            of responsibility.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden">
          {roles.map((role) => {
            const areas = areaCountMap[role.id] ?? 0;
            const members = memberCountMap[role.id] ?? 0;
            return (
              <Link
                key={role.id}
                href={`/roles/${role.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{role.title}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {areas > 0 && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {areas} area{areas !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {members > 0 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {members} member{members !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
