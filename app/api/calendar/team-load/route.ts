import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken, fetchMemberEventCount } from "@/lib/google/calendar";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const accessToken = await getValidToken(supabase, user.id);

    const { data: members } = await supabase
      .from("team_members")
      .select("id, email")
      .not("email", "is", null);

    if (!members || members.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const results = await Promise.all(
      members.map(async (m) => {
        const count = await fetchMemberEventCount(
          accessToken,
          m.email!,
          monthStart,
          monthEnd,
        );
        return [m.id, count] as [string, number];
      }),
    );

    const counts = Object.fromEntries(results);
    return NextResponse.json({ counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not connected")) {
      return NextResponse.json({ counts: {}, connected: false });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
