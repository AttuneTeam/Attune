"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { SignalType } from "@/lib/supabase/types";

type SignalRow = {
  id: string;
  signal: SignalType;
  note: string | null;
  created_at: string;
  interactions: {
    id: string;
    title: string | null;
    scheduled_at: string;
    team_members: { id: string; name: string } | null;
  } | null;
};

const SIGNAL_CONFIG: Record<SignalType, { label: string; icon: React.ElementType; className: string }> = {
  advances: { label: "Advances", icon: TrendingUp, className: "text-blue-500" },
  reinforces: { label: "Reinforces", icon: Shield, className: "text-green-500" },
  threatens: { label: "Threatens", icon: AlertTriangle, className: "text-destructive" },
};

export function InitiativeSignalsSummary({ initiativeId }: { initiativeId: string }) {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/initiatives/${initiativeId}/signals`)
      .then((r) => r.json())
      .then((data) => {
        setSignals(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [initiativeId]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (signals.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No signals yet. Link interactions from the interaction editor.
      </p>
    );
  }

  const grouped = (["advances", "reinforces", "threatens"] as SignalType[]).map((type) => ({
    type,
    items: signals.filter((s) => s.signal === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="flex gap-3">
        {(["advances", "reinforces", "threatens"] as SignalType[]).map((type) => {
          const count = signals.filter((s) => s.signal === type).length;
          if (count === 0) return null;
          const cfg = SIGNAL_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <div key={type} className="flex items-center gap-1 text-xs">
              <Icon className={`h-3.5 w-3.5 ${cfg.className}`} />
              <span className="font-medium">{count}</span>
              <span className="text-muted-foreground">{cfg.label.toLowerCase()}</span>
            </div>
          );
        })}
      </div>

      {/* Grouped interactions */}
      {grouped.map(({ type, items }) => {
        const cfg = SIGNAL_CONFIG[type];
        const Icon = cfg.icon;
        return (
          <div key={type}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon className={`h-3 w-3 ${cfg.className}`} />
              <span className="text-xs font-medium">{cfg.label}</span>
            </div>
            <div className="space-y-1 pl-4">
              {items.map((s) => {
                const interactionTitle =
                  s.interactions?.title ??
                  (s.interactions?.team_members
                    ? `1-on-1 with ${s.interactions.team_members.name}`
                    : "Interaction");
                return (
                  <div key={s.id}>
                    <Link
                      href={`/interactions/${s.interactions?.id}`}
                      className="text-xs hover:underline underline-offset-2 line-clamp-1"
                    >
                      {interactionTitle}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      {s.interactions?.scheduled_at
                        ? format(new Date(s.interactions.scheduled_at), "MMM d, yyyy")
                        : ""}
                      {s.note && ` · ${s.note}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
