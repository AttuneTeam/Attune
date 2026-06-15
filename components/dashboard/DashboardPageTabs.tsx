"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PersonalTab } from "./PersonalTab";
import { ManagerProfileInsights } from "@/components/account/ManagerProfileInsights";
import { InteractionsSheet } from "@/components/dashboard/InteractionsSheet";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
import { DashboardActionItems } from "@/components/dashboard/DashboardActionItems";
import type { ActionItem, TeamMember } from "@/lib/supabase/types";
import Link from "next/link";

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type PreviewItem = {
  id: string;
  title: string | null;
  scheduled_at: string;
  sentiment_score: number | null;
  memberName: string;
};

export function DashboardPageTabs({
  userId,
  hasGoogleCalendar,
  interactionsPreview,
  totalThisMonth,
  totalMinutesThisMonth,
  upcomingBookings,
  actionItems,
  members,
}: {
  userId: string;
  hasGoogleCalendar: boolean;
  interactionsPreview: PreviewItem[];
  totalThisMonth: number;
  totalMinutesThisMonth: number;
  upcomingBookings: any[];
  actionItems: ActionItem[];
  members: TeamMember[];
}) {
  const statLabel = totalMinutesThisMonth > 0
    ? `${totalThisMonth} interactions · ${formatHours(totalMinutesThisMonth)}`
    : `${totalThisMonth} interaction${totalThisMonth !== 1 ? "s" : ""} this month`;

  return (
    <Tabs defaultValue="personal">
      <div className="flex items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="my-profile">My Profile</TabsTrigger>
        </TabsList>
        <InteractionsSheet
          preview={interactionsPreview}
          totalThisMonth={totalThisMonth}
          totalMinutesThisMonth={totalMinutesThisMonth}
          trigger={
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {statLabel}
            </button>
          }
        />
      </div>

      <TabsContent value="personal">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 pt-4">
          <PersonalTab initialItems={actionItems} userId={userId} />

          <div className="space-y-4">

            {upcomingBookings.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Upcoming
                </h2>
                <UpcomingList bookings={upcomingBookings as never} />
              </div>
            )}

            {/* Unified action items list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Open Action Items
                </h2>
                <Link
                  href="/action-items"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </Link>
              </div>
              <DashboardActionItems
                items={actionItems as never}
                members={members}
              />
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
