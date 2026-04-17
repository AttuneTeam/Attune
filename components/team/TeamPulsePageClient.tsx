"use client";

import { useState } from "react";
import { TeamPulseCard } from "@/components/team/TeamPulseCard";
import { AttentionTrackerCard } from "@/components/team/AttentionTrackerCard";
import { TeamSentimentOverview } from "@/components/team/TeamSentimentOverview";
import { TeamThemesCard } from "@/components/team/TeamThemesCard";

interface SentimentPoint {
  date: string;
  score: number;
  memberName: string;
}

interface AttentionMetric {
  name: string;
  level: string;
  daysSinceLastMeeting: number | null;
  interactionCount30d: number;
  memberId: string;
}

interface TeamTheme {
  theme: string;
  count: number;
  members: string[];
}

interface Props {
  attentionMetrics: AttentionMetric[];
  sentimentData: SentimentPoint[];
  memberNames: string[];
  initialTeamThemes: TeamTheme[];
}

export function TeamPulsePageClient({
  attentionMetrics,
  sentimentData,
  memberNames,
  initialTeamThemes,
}: Props) {
  const [teamThemes, setTeamThemes] = useState<TeamTheme[]>(initialTeamThemes);

  function handlePulseResult(data: {
    team_themes?: TeamTheme[];
  }) {
    if (data.team_themes?.length) {
      setTeamThemes(data.team_themes);
    }
  }

  return (
    <div className="space-y-8">
      {/* AI Narrative */}
      <TeamPulseCard onResultLoaded={handlePulseResult} />

      {/* Data views: 2-col on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttentionTrackerCard metrics={attentionMetrics} />
        <TeamSentimentOverview
          data={sentimentData}
          memberNames={memberNames}
        />
      </div>

      {/* Themes full width */}
      <TeamThemesCard themes={teamThemes} />
    </div>
  );
}
