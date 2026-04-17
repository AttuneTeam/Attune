"use client";

import Link from "next/link";

interface MemberMetric {
  name: string;
  level: string;
  daysSinceLastMeeting: number | null;
  interactionCount30d: number;
  memberId?: string;
}

interface Props {
  metrics: MemberMetric[];
}

function cadenceColor(days: number | null): string {
  if (days === null) return "bg-muted text-muted-foreground";
  if (days <= 7) return "bg-[#6D998F]/15 text-[#6D998F]";
  if (days <= 21) return "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400";
  return "bg-destructive/10 text-destructive";
}

function cadenceLabel(days: number | null): string {
  if (days === null) return "No record";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function AttentionTrackerCard({ metrics }: Props) {
  const sorted = [...metrics].sort((a, b) => {
    const da = a.daysSinceLastMeeting ?? Infinity;
    const db = b.daysSinceLastMeeting ?? Infinity;
    return db - da;
  });

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        1-on-1 Cadence
      </h2>
      <div className="rounded-lg border bg-card divide-y divide-border">
        {sorted.map((m) => (
          <div
            key={m.name}
            className="flex items-center justify-between px-4 py-2.5 gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              {m.memberId ? (
                <Link
                  href={`/team/${m.memberId}`}
                  className="text-sm font-medium truncate hover:underline"
                >
                  {m.name}
                </Link>
              ) : (
                <span className="text-sm font-medium truncate">{m.name}</span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {m.level}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {m.interactionCount30d}× this month
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${cadenceColor(m.daysSinceLastMeeting)}`}
              >
                {cadenceLabel(m.daysSinceLastMeeting)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
