"use client";

import { useState } from "react";
import { format, parseISO, isPast } from "date-fns";
import { ArrowRight, Circle, Clock, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ActionItemsTable } from "@/components/ActionItemsTable";
import { createClient } from "@/lib/supabase/client";

type PreviewItem = {
  id: string;
  description: string;
  status: string;
  due_date: string | null;
  memberName: string;
};

interface Props {
  preview: PreviewItem[];
  totalOpen: number;
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "done") return <Check className="h-3.5 w-3.5 text-green-500" />;
  if (status === "in_progress")
    return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
};

export function ActionItemsSheet({ preview, totalOpen }: Props) {
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadItems() {
    if (items !== null) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("action_items")
      .select(
        `id, description, status, due_date, created_at, assignee_id,
         interactions!inner(id, scheduled_at, manager_id, team_members(id, name))`,
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100);
    setItems(data ?? []);
    setLoading(false);
  }

  return (
    <Sheet onOpenChange={(open) => open && loadItems()}>
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Open action items
            </p>
            <p className="text-3xl font-bold">{totalOpen}</p>
          </div>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                Manage <ArrowRight className="h-3 w-3" />
              </Button>
            }
          />
        </div>

        {preview.length > 0 && (
          <ul className="divide-y">
            {preview.slice(0, 3).map((item) => {
              const overdue =
                item.due_date &&
                item.status !== "done" &&
                isPast(parseISO(item.due_date));
              return (
                <li
                  key={item.id}
                  className="py-2 first:pt-0 last:pb-0 flex items-start gap-2"
                >
                  <StatusIcon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.memberName}
                      {item.due_date && (
                        <span
                          className={overdue ? "text-destructive ml-1" : "ml-1"}
                        >
                          · due {format(parseISO(item.due_date), "MMM d")}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <SheetContent className="sm:max-w-3xl overflow-y-auto p-0 gap-0">
        <SheetHeader className="border-b px-6 py-4 sticky top-0 bg-popover">
          <SheetTitle>Action Items</SheetTitle>
        </SheetHeader>
        <div className="p-6">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          ) : !items || items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No action items yet.</p>
          ) : (
            <ActionItemsTable items={items as never} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
