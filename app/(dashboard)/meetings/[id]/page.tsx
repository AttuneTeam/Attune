import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { MeetingEditorClient } from "@/components/meetings/MeetingEditorClient";

export default async function MeetingEditorPage({
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

  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      `
      id, scheduled_at, raw_json_notes, ai_summary, sentiment_score, key_themes, title,
      team_members (id, name, level, role_description)
    `,
    )
    .eq("id", id)
    .single();

  if (!meeting) notFound();

  const { data: actionItems } = await supabase
    .from("action_items")
    .select("*")
    .eq("meeting_id", id)
    .order("created_at");

  const { data: allMembers } = await supabase
    .from("team_members")
    .select("id, name")
    .order("name");

  return (
    <MeetingEditorClient
      meeting={meeting as never}
      initialActionItems={actionItems ?? []}
      allMembers={allMembers ?? []}
    />
  );
}
