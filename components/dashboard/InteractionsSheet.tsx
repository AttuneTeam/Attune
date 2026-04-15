"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface Props {
  preview: PreviewItem[];
  totalThisMonth: number;
}

function sentimentVariant(score: number | null) {
  if (score === null) return "outline" as const;
  if (score >= 0.3) return "default" as const;
  if (score >= -0.3) return "secondary" as const;
  return "destructive" as const;
}

export function InteractionsSheet({ preview, totalThisMonth }: Props) {
  const [interactions, setInteractions] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadInteractions() {
    if (interactions !== null) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("interactions")
      .select(
        "id, scheduled_at, ai_summary, sentiment_score, key_themes, title, type, team_members(id, name, level)",
      )
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false })
      .limit(50);
    setInteractions(data ?? []);
    setLoading(false);
  }

  return (
    <Sheet onOpenChange={(open) => open && loadInteractions()}>
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Interactions this month
            </p>
            <p className="text-3xl font-bold">{totalThisMonth}</p>
          </div>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            }
          />
        </div>
      </div>

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
