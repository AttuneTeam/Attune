"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PersonalTab } from "./PersonalTab";
import { PersonalCalendarWidget } from "@/components/calendar/PersonalCalendarWidget";
import { ManagerProfileInsights } from "@/components/account/ManagerProfileInsights";
import { InteractionsSheet } from "@/components/dashboard/InteractionsSheet";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
import { DashboardActionItems } from "@/components/dashboard/DashboardActionItems";
import type { PersonalItem } from "@/lib/supabase/types";

type PreviewItem = {
  id: string;
  title: string | null;
  scheduled_at: string;
  sentiment_score: number | null;
  memberName: string;
};

export function DashboardPageTabs({
  personalItems,
  userId,
  hasGoogleCalendar,
  interactionsPreview,
  totalThisMonth,
  totalMinutesThisMonth,
  upcomingBookings,
  actionItems,
}: {
  personalItems: PersonalItem[];
  userId: string;
  hasGoogleCalendar: boolean;
  interactionsPreview: PreviewItem[];
  totalThisMonth: number;
  totalMinutesThisMonth: number;
  upcomingBookings: any[];
  actionItems: any[];
}) {
  return (
    <Tabs defaultValue="personal">
      <TabsList>
        <TabsTrigger value="personal">Personal</TabsTrigger>
        <TabsTrigger value="my-profile">My Profile</TabsTrigger>
      </TabsList>

      <TabsContent value="personal">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 pt-4">
          <PersonalTab initialItems={personalItems} userId={userId} />
          <div className="space-y-4">
            <PersonalCalendarWidget connected={hasGoogleCalendar} />
            <InteractionsSheet
              preview={interactionsPreview}
              totalThisMonth={totalThisMonth}
              totalMinutesThisMonth={totalMinutesThisMonth}
            />
            {upcomingBookings.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Upcoming
                </h2>
                <UpcomingList bookings={upcomingBookings as never} />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Action Items
                </h2>
                <a
                  href="/action-items"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </a>
              </div>
              <DashboardActionItems items={actionItems as never} />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="my-profile">
        <ManagerProfileInsights />
      </TabsContent>
    </Tabs>
  );
}
