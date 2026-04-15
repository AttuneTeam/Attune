import { NextRequest, NextResponse } from "next/server";

const SLACK_API = "https://slack.com/api";

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");

  if (!memberId) {
    return NextResponse.json({ messages: [] });
  }

  const token = process.env.SLACK_TOKEN;
  if (!token) {
    return NextResponse.json({ messages: [] });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // Find the DM channel between the manager and the team member
    const openRes = await fetch(`${SLACK_API}/conversations.open`, {
      method: "POST",
      headers,
      body: JSON.stringify({ users: memberId }),
    });
    const openData = await openRes.json();

    if (!openData.ok || !openData.channel?.id) {
      return NextResponse.json({ messages: [] });
    }

    const channelId = openData.channel.id as string;

    // Fetch last 5 messages
    const histRes = await fetch(
      `${SLACK_API}/conversations.history?channel=${channelId}&limit=5`,
      { headers },
    );
    const histData = await histRes.json();

    if (!histData.ok || !Array.isArray(histData.messages)) {
      return NextResponse.json({ messages: [] });
    }

    const messages = (
      histData.messages as Array<{ ts: string; user: string; text?: string }>
    ).map((msg) => ({
      ts: msg.ts,
      user: msg.user,
      text: msg.text ?? "",
      isFromMember: msg.user === memberId,
    }));

    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
