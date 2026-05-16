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
      id, scheduled_at, raw_json_notes, ai_summary, sentiment_score, key_themes, coaching_questions, title, type, duration_minutes, google_calendar_event_id,
      team_members (id, name, level, role_description, manager_read, is_squad_lead, role_id, team_id)
    `,
    )
    .eq("id", id)
    .single();

  if (!interaction) notFound();

  const member = interaction.team_members as unknown as {
    role_id: string | null;
    team_id: string | null;
  } | null;

  const [assignedRole, teamName, actionItems, agendaItems, allMembers, googleToken] =
    await Promise.all([
      member?.role_id
        ? supabase
            .from("roles")
            .select("id, title")
            .eq("id", member.role_id)
            .single()
            .then(({ data }) =>
              data ? (data as { id: string; title: string }) : null,
            )
        : Promise.resolve(null),
      member?.team_id
        ? supabase
            .from("teams")
            .select("name")
            .eq("id", member.team_id)
            .single()
            .then(({ data }) => data?.name ?? null)
        : Promise.resolve(null),
      supabase
        .from("action_items")
        .select("*")
        .eq("interaction_id", id)
        .order("created_at")
        .then(({ data }) => data ?? []),
      supabase
        .from("agenda_items")
        .select("*")
        .eq("interaction_id", id)
        .order("created_at")
        .then(({ data }) => data ?? []),
      supabase
        .from("team_members")
        .select("id, name")
        .order("name")
        .then(({ data }) => data ?? []),
      supabase
        .from("user_oauth_tokens")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle()
        .then(({ data }) => !!data),
    ]);

  return (
    <InteractionEditorClient
      interaction={interaction as never}
      initialActionItems={actionItems}
      initialAgendaItems={agendaItems}
      allMembers={allMembers}
      assignedRole={assignedRole}
      teamName={teamName ?? null}
      hasGoogleCalendar={googleToken}
    />
  );
}
