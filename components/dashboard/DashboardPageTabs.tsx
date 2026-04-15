"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PersonalTab } from "./PersonalTab";
import { PersonalCalendarWidget } from "@/components/calendar/PersonalCalendarWidget";
import type { PersonalItem } from "@/lib/supabase/types";

export function DashboardPageTabs({
  teamContent,
  personalItems,
  userId,
  hasGoogleCalendar,
}: {
  teamContent: React.ReactNode;
  personalItems: PersonalItem[];
  userId: string;
  hasGoogleCalendar: boolean;
}) {
  return (
    <Tabs defaultValue="personal">
      <TabsList>
        <TabsTrigger value="personal">Personal</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
      </TabsList>

      <TabsContent value="personal">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 pt-4">
          <PersonalTab initialItems={personalItems} userId={userId} />
          <div>
            <PersonalCalendarWidget connected={hasGoogleCalendar} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="team">{teamContent}</TabsContent>
    </Tabs>
  );
}
