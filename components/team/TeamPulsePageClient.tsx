"use client";

import { useState } from "react";
import { TeamPulseCard } from "@/components/team/TeamPulseCard";
import { AttentionTrackerCard } from "@/components/team/AttentionTrackerCard";
import { TeamSentimentOverview } from "@/components/team/TeamSentimentOverview";
import { TeamThemesCard } from "@/components/team/TeamThemesCard";
import { TeamCoverageCard } from "@/components/team/TeamCoverageCard";
import { OrgTreeDisplay } from "@/components/dashboard/OrgStructureSheet";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import type { Team, TeamMember } from "@/lib/supabase/types";

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
  teams: Team[];
  members: TeamMember[];
}

export function TeamPulsePageClient({
  attentionMetrics,
  sentimentData,
  memberNames,
  initialTeamThemes,
  teams,
  members,
}: Props) {
  const [teamThemes, setTeamThemes] = useState<TeamTheme[]>(initialTeamThemes);

  function handlePulseResult(data: { team_themes?: TeamTheme[] }) {
    if (data.team_themes?.length) {
      setTeamThemes(data.team_themes);
    }
  }

  return (
    <Tabs defaultValue="pulse">
      <TabsList>
        <TabsTrigger value="pulse">How the team feels</TabsTrigger>
        <TabsTrigger value="structure">The team structure</TabsTrigger>
      </TabsList>

      <TabsContent value="pulse">
        <div className="space-y-8 pt-4">
          <TeamPulseCard onResultLoaded={handlePulseResult} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AttentionTrackerCard metrics={attentionMetrics} />
            <TeamSentimentOverview
              data={sentimentData}
              memberNames={memberNames}
            />
          </div>
          <TeamThemesCard themes={teamThemes} />
        </div>
      </TabsContent>

      <TabsContent value="structure">
        <div className="space-y-8 pt-4">
          <OrgTreeDisplay teams={teams} members={members} />
          <TeamCoverageCard />
        </div>
      </TabsContent>
    </Tabs>
  );
}
