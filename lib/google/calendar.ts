import type { SupabaseClient } from "@supabase/supabase-js";

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  attendees?: { email: string; displayName?: string }[];
  htmlLink?: string;
  description?: string;
}

// ─── Token management ────────────────────────────────────────────────────────

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${await res.text()}`);
  }
  return res.json();
}

/** Returns a valid access token, refreshing if needed. Throws if no token is stored. */
export async function getValidToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: token, error } = await supabase
    .from("user_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (error || !token) throw new Error("Google Calendar not connected");

  if (!token.refresh_token) return token.access_token;

  const parsedExpiry = token.expires_at ? new Date(token.expires_at).getTime() : NaN;
  const expiresAt = Number.isNaN(parsedExpiry) ? 0 : parsedExpiry;
  const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

  if (expiresAt < fiveMinFromNow) {
    return doRefresh(supabase, userId, token.refresh_token);
  }

  return token.access_token;
}

async function doRefresh(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string,
): Promise<string> {
  const refreshed = await refreshAccessToken(refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("user_oauth_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google");

  return refreshed.access_token;
}

// ─── Calendar API calls ───────────────────────────────────────────────────────

function parseEventDateTime(dt: { dateTime?: string; date?: string }): string {
  return dt.dateTime ?? dt.date ?? new Date().toISOString();
}

function mapEvent(raw: Record<string, unknown>): CalendarEvent {
  const start = raw.start as { dateTime?: string; date?: string };
  const end = raw.end as { dateTime?: string; date?: string };
  return {
    id: raw.id as string,
    summary: (raw.summary as string) ?? "(No title)",
    start: parseEventDateTime(start),
    end: parseEventDateTime(end),
    attendees: raw.attendees as CalendarEvent["attendees"],
    htmlLink: raw.htmlLink as string | undefined,
    description: raw.description as string | undefined,
  };
}

/** Fetch upcoming events from the manager's primary calendar. */
export async function fetchUpcomingEvents(
  accessToken: string,
  days = 14,
): Promise<CalendarEvent[]> {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    maxResults: "50",
    orderBy: "startTime",
    singleEvents: "true",
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (res.status === 401) throw new Error("Google token revoked or expired");
  if (!res.ok) throw new Error(`Google Calendar API error: ${await res.text()}`);
  const data = await res.json();
  return ((data.items ?? []) as Record<string, unknown>[]).map(mapEvent);
}

/**
 * Fetch total meeting minutes for a team member for a given date range.
 * Only counts timed events (skips all-day events).
 * Returns 0 if the calendar is not accessible (not shared or not on Workspace).
 */
export async function fetchMemberMeetingMinutes(
  accessToken: string,
  memberEmail: string,
  from: Date,
  to: Date,
): Promise<number> {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    maxResults: "250",
    singleEvents: "true",
  });

  const calendarId = encodeURIComponent(memberEmail);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return 0;
  const data = await res.json();
  return ((data.items ?? []) as Record<string, unknown>[]).reduce((total, event) => {
    const start = event.start as { dateTime?: string; date?: string } | undefined;
    const end = event.end as { dateTime?: string; date?: string } | undefined;
    if (!start?.dateTime || !end?.dateTime) return total;
    return total + eventDurationMinutes(start.dateTime, end.dateTime);
  }, 0);
}

/**
 * Count calendar events for a specific team member email for the given month.
 * Uses their calendar directly (requires Workspace domain sharing or explicit share).
 */
export async function fetchMemberEventCount(
  accessToken: string,
  memberEmail: string,
  from: Date,
  to: Date,
): Promise<number> {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    maxResults: "250",
    singleEvents: "true",
  });

  const calendarId = encodeURIComponent(memberEmail);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return 0; // Return 0 if calendar is not accessible
  const data = await res.json();
  return ((data.items ?? []) as unknown[]).length;
}

/** Search events for the interaction editor picker. */
export async function fetchEventsForPicker(
  accessToken: string,
  query?: string,
  daysBack = 7,
  daysAhead = 7,
): Promise<CalendarEvent[]> {
  const now = new Date();
  const timeMin = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: "20",
    orderBy: "startTime",
    singleEvents: "true",
  });
  if (query) params.set("q", query);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) throw new Error(`Google Calendar API error: ${await res.text()}`);
  const data = await res.json();
  return ((data.items ?? []) as Record<string, unknown>[]).map(mapEvent);
}

/** Calculate duration in minutes between two ISO datetime strings. */
export function eventDurationMinutes(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / 60000);
}
