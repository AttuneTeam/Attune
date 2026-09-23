import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AccountPageClient } from "@/components/account/AccountPageClient";
import { OrganizationSettings, type ManagedOrganization } from "@/components/account/OrganizationSettings";
import Link from "next/link";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: googleToken }, { data: roles }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("user_oauth_tokens")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle(),
    supabase
      .from("roles")
      .select("id, title")
      .eq("manager_id", user.id)
      .order("title"),
    supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("user_id", user.id),
  ]);

  const organizationIds = memberships?.map((membership: { organization_id: string }) => membership.organization_id) ?? [];
  const { data: organizations } = organizationIds.length
    ? await supabase.from("organizations").select("id, name, archived_at").in("id", organizationIds).order("created_at")
    : { data: [] };
  const managedOrganizations: ManagedOrganization[] = (organizations ?? []).map((organization: {
    id: string;
    name: string;
    archived_at: string | null;
  }) => ({
    ...organization,
    role: memberships?.find((membership: { organization_id: string }) => membership.organization_id === organization.id)?.role ?? "member",
  }));
  const cookieStore = await cookies();
  const selectedOrganizationId = cookieStore.get("active-organization-id")?.value;
  const activeOrganizationId = managedOrganizations.find(
    (organization) => organization.id === selectedOrganizationId && organization.archived_at === null,
  )?.id ?? managedOrganizations.find((organization) => organization.archived_at === null)?.id ?? null;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Your Profile</h1>
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Settings</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your organisation, team, roles, and knowledge base.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            ["/settings/org", "Organisation", "Manage your organisation and company context."],
            ["/team", "Team", "Manage team members and structure."],
            ["/roles", "Roles", "Define the roles used by your team."],
            ["/settings/knowledge", "Knowledge", "Manage documents used by the AI assistant."],
          ].map(([href, label, description]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
            >
              <p className="text-sm font-medium">{label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      </section>
      <OrganizationSettings
        organizations={managedOrganizations}
        activeOrganizationId={activeOrganizationId}
      />
      <AccountPageClient
        profile={profile}
        email={user.email ?? ""}
        hasGoogleCalendar={!!googleToken}
        availableRoles={roles ?? []}
      />
    </div>
  );
}
