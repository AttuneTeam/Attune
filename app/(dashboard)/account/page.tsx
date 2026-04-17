import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AccountPageClient } from "@/components/account/AccountPageClient";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: googleToken }, { data: roles }] = await Promise.all([
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
  ]);

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Your Profile</h1>
      <AccountPageClient
        profile={profile}
        email={user.email ?? ""}
        hasGoogleCalendar={!!googleToken}
        availableRoles={roles ?? []}
      />
    </div>
  );
}
