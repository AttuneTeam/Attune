"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { TeamMember } from "@/lib/supabase/types";

function sentimentBadge(score: number | null) {
  if (score === null) return null;
  if (score >= 0.3) return { label: "Positive", variant: "default" as const };
  if (score >= -0.3) return { label: "Neutral", variant: "secondary" as const };
  return { label: "Concerning", variant: "destructive" as const };
}

interface Props {
  member: TeamMember;
  daysSince: number | null;
  currentSentiment: number | null;
  openActionCount: number;
}

export function TeamMemberCard({
  member,
  daysSince,
  currentSentiment,
  openActionCount,
}: Props) {
  const overdue = daysSince === null || daysSince > 14;
  const sentiment = sentimentBadge(currentSentiment);

  return (
    <Link
      href={`/team/${member.id}`}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.name}</p>
        {member.level && (
          <p className="text-xs text-muted-foreground capitalize">{member.level}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant={overdue ? "destructive" : "outline"}
          className="text-xs tabular-nums"
        >
          {daysSince === null
            ? "No check-in"
            : daysSince === 0
              ? "Today"
              : `${daysSince}d ago`}
        </Badge>

        {sentiment ? (
          <Badge variant={sentiment.variant} className="text-xs">
            {sentiment.label}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            No data
          </Badge>
        )}

        <Badge
          variant={openActionCount > 0 ? "secondary" : "outline"}
          className="text-xs tabular-nums"
        >
          {openActionCount} open
        </Badge>
      </div>
    </Link>
  );
}
