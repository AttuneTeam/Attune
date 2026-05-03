import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkshopCanvas } from "@/components/workshop/WorkshopCanvas";
import type { WorkshopSession } from "@/lib/supabase/types";

export default async function WorkshopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessions } = await (supabase as any)
    .from("workshop_sessions")
    .select("id, question, persona_ids, persona_analyses, synthesis, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      <WorkshopCanvas
        userId={user.id}
        initialSessions={(sessions ?? []) as WorkshopSession[]}
      />
    </div>
  );
}
