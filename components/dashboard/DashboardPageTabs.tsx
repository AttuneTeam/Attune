"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PersonalTab } from "./PersonalTab";
import type { PersonalItem } from "@/lib/supabase/types";

export function DashboardPageTabs({
  teamContent,
  personalItems,
  userId,
}: {
  teamContent: React.ReactNode;
  personalItems: PersonalItem[];
  userId: string;
}) {
  return (
    <Tabs defaultValue="personal">
      <TabsList>
        <TabsTrigger value="personal">Personal</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
      </TabsList>

      <TabsContent value="personal">
        <PersonalTab initialItems={personalItems} userId={userId} />
      </TabsContent>

      <TabsContent value="team">{teamContent}</TabsContent>
    </Tabs>
  );
}
