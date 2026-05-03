"use client";

import { formatDistanceToNow } from "date-fns";
import type { WorkshopSession } from "@/lib/supabase/types";
import { PERSONAS } from "@/lib/ai/personas";
import { cn } from "@/lib/utils";

const personaMap = Object.fromEntries(PERSONAS.map((p) => [p.id, p.name]));

export function WorkshopHistory({
  sessions,
  activeId,
  onSelect,
}: {
  sessions: WorkshopSession[];
  activeId: string | null;
  onSelect: (session: WorkshopSession) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
          History
        </p>
        <p className="text-xs text-muted-foreground">No sessions yet</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
        History
      </p>
      <div className="space-y-1">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect(session)}
            className={cn(
              "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
              activeId === session.id
                ? "bg-primary/10 text-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <p className="text-xs font-medium line-clamp-2 leading-snug">
              {session.question}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {session.persona_ids
                .map((id) => personaMap[id] ?? id)
                .join(", ")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
