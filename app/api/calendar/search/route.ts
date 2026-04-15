import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken, fetchEventsForPicker } from "@/lib/google/calendar";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? undefined;

  try {
    const accessToken = await getValidToken(supabase, user.id);
    const events = await fetchEventsForPicker(accessToken, query);
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not connected")) {
      return NextResponse.json({ events: [], connected: false });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
