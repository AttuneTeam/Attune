import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken, fetchUpcomingEvents } from "@/lib/google/calendar";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const accessToken = await getValidToken(supabase, user.id);
    const events = await fetchUpcomingEvents(accessToken, 14);

    const eventIds = events.map((e) => e.id).filter(Boolean);
    let syncedEventIds: string[] = [];
    if (eventIds.length > 0) {
      const { data: synced } = await supabase
        .from("interactions")
        .select("google_calendar_event_id")
        .eq("manager_id", user.id)
        .in("google_calendar_event_id", eventIds);
      syncedEventIds = (synced ?? [])
        .map((r) => r.google_calendar_event_id)
        .filter(Boolean) as string[];
    }

    return NextResponse.json({ events, syncedEventIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not connected") || message.includes("revoked")) {
      return NextResponse.json({ events: [], connected: false });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
