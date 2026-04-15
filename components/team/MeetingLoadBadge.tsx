"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

interface MeetingLoadBadgeProps {
  memberId: string;
}

// Module-level cache so the fetch happens once per page render
let cachedCounts: Record<string, number> | null = null;
let fetchPromise: Promise<Record<string, number>> | null = null;

function getTeamLoad(): Promise<Record<string, number>> {
  if (cachedCounts) return Promise.resolve(cachedCounts);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/calendar/team-load")
    .then((r) => r.json())
    .then((data) => {
      cachedCounts = data.counts ?? {};
      fetchPromise = null;
      return cachedCounts!;
    })
    .catch(() => {
      fetchPromise = null;
      return {} as Record<string, number>;
    });
  return fetchPromise;
}

export function MeetingLoadBadge({ memberId }: MeetingLoadBadgeProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    getTeamLoad().then((counts) => {
      const c = counts[memberId];
      if (c !== undefined) setCount(c);
    });
  }, [memberId]);

  if (count === null) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={`${count} meetings this month`}
    >
      <CalendarDays className="h-3 w-3" />
      {count}
    </span>
  );
}
