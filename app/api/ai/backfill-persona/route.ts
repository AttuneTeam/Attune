import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { backfillPersona } from "@/lib/ai/member-persona";

// One-time cold start: build version 1 of a member's persona from their full
// summarised interaction history. POST { memberId }.
export async function POST(request: NextRequest) {
  const { memberId } = await request.json();
  if (!memberId) return new Response("memberId required", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("id, name, level, manager_id")
    .eq("id", memberId)
    .single();

  if (!member || member.manager_id !== user.id)
    return new Response("Member not found", { status: 404 });

  const result = await backfillPersona(supabase, {
    memberId: member.id,
    memberName: member.name,
    memberLevel: member.level,
    managerId: user.id,
  });

  return Response.json(result);
}
