import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { InteractionEditorClient } from "@/components/meetings/InteractionEditorClient";

export default async function InteractionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: interaction } = await supabase
    .from("interactions")
    .select(
      `
      id, scheduled_at, raw_json_notes, ai_summary, sentiment_score, key_themes, title, type,
      team_members (id, name, level, role_description)
    `,
    )
    .eq("id", id)
    .single();

  if (!interaction) notFound();

  const { data: actionItems } = await supabase
    .from("action_items")
    .select("*")
    .eq("interaction_id", id)
    .order("created_at");

  const { data: allMembers } = await supabase
    .from("team_members")
    .select("id, name")
    .order("name");

  return (
    <InteractionEditorClient
      interaction={interaction as never}
      initialActionItems={actionItems ?? []}
      allMembers={allMembers ?? []}
    />
  );
}
