"use client";

import { format } from "date-fns";

interface DayHours {
  date: string;
  minutes: number;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function MeetingLoadChart({ history }: { history: DayHours[] }) {
  return (
    <div className="flex gap-1">
      {[...history].reverse().map((h) => {
        const pct = Math.min(100, Math.round((h.minutes / (8 * 60)) * 100));
        return (
          <div
            key={h.date}
            className="flex-1 flex flex-col items-center gap-0.5"
          >
            <span className="text-[9px] text-muted-foreground leading-none tabular-nums">
              {h.minutes > 0 ? formatMinutes(h.minutes) : ""}
            </span>
            <div className="w-full flex items-end" style={{ height: "2rem" }}>
              <div
                className="w-full bg-primary/20 rounded-sm"
                style={{ height: `${Math.max(4, pct)}%` }}
                title={format(new Date(h.date), "MMM d")}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
