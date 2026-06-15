"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { InteractionCard } from "@/components/meetings/InteractionCard";
import { createClient } from "@/lib/supabase/client";

type PreviewItem = {
  id: string;
  title: string | null;
  scheduled_at: string;
  sentiment_score: number | null;
  memberName: string;
};

function formatHours(minutes: number): string {
  if (minutes === 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface Props {
  preview: PreviewItem[];
  totalThisMonth: number;
  totalMinutesThisMonth: number;
  trigger: React.ReactElement;
}

export function InteractionsSheet({
  totalThisMonth,
  totalMinutesThisMonth,
  trigger,
}: Props) {
  const [interactions, setInteractions] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadInteractions() {
    if (interactions !== null) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("interactions")
      .select(
        "id, scheduled_at, ai_summary, sentiment_score, key_themes, title, type, duration_minutes, team_members(id, name, level)",
      )
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false })
      .limit(50);
    setInteractions(data ?? []);
    setLoading(false);
  }

  return (
    <Sheet onOpenChange={(open) => open && loadInteractions()}>
      <SheetTrigger render={trigger} />

      <SheetContent className="sm:max-w-2xl overflow-y-auto p-0 gap-0">
        <SheetHeader className="border-b px-6 py-4 sticky top-0 bg-popover">
          <SheetTitle>Interactions</SheetTitle>
        </SheetHeader>
        <div className="p-6 space-y-3">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg" />
              ))}
            </div>
          ) : !interactions || interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No interactions yet.
            </p>
          ) : (
            interactions.map((interaction) => (
              <InteractionCard key={interaction.id} interaction={interaction} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
