"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { format, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Circle,
  Trash2,
  Pencil,
  MessageSquareWarning,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  ActionItemEditDialog,
  type ActionItemUpdates,
} from "@/components/action-items/ActionItemEditDialog";

interface ActionItemRow {
  id: string;
  title: string | null;
  description: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  created_at: string;
  interactions: {
    id: string;
    scheduled_at: string;
    team_members: { id: string; name: string } | null;
  } | null;
}

interface Member {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  {
    value: "open",
    label: "Open",
    icon: Circle,
    className: "text-muted-foreground",
  },
  {
    value: "in_progress",
    label: "In progress",
    icon: Clock,
    className: "text-amber-500",
  },
  { value: "done", label: "Done", icon: Check, className: "text-green-500" },
];

function StatusIcon({ status }: { status: string }) {
  const opt =
    STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
  const Icon = opt.icon;
  return <Icon className={`h-3.5 w-3.5 ${opt.className}`} />;
}

export function ActionItemsTable({
  items,
  members = [],
}: {
  items: ActionItemRow[];
  members?: Member[];
}) {
  const [localItems, setLocalItems] = useState(items);
  const [editingItem, setEditingItem] = useState<ActionItemRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ActionItemRow | null>(
    null,
  );
  const router = useRouter();

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleSaveEdit = async (updates: ActionItemUpdates) => {
    if (!editingItem) return;
    const id = editingItem.id;
    setLocalItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .update(updates)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      setLocalItems(items);
    } else {
      setEditingItem(null);
      router.refresh();
    }
  };

  const changeStatus = async (item: ActionItemRow, newStatus: string) => {
    setLocalItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .update({ status: newStatus })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      setLocalItems(items);
    } else {
      router.refresh();
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setPendingDelete(null);
    setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .delete()
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      setLocalItems(items);
    } else {
      router.refresh();
    }
  };

  if (localItems.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No action items match this filter.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b">
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Task
              </th>
              <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                Assignee
              </th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Due
              </th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 bg-card">
            {localItems.map((item) => {
              const done = item.status === "done";
              const overdue =
                !done && item.due_date && isPast(parseISO(item.due_date));
              const assignee = item.assignee_id
                ? members.find((m) => m.id === item.assignee_id)
                : item.interactions?.team_members;
              const assigneeId =
                item.assignee_id ?? item.interactions?.team_members?.id;

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-muted/30 transition-colors ${done ? "opacity-50" : ""}`}
                >
                  {/* Status dropdown */}
                  <td className="px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            className="p-0.5 rounded hover:bg-muted flex items-center justify-center"
                            title="Change status"
                          >
                            <StatusIcon status={item.status} />
                          </button>
                        }
                      />
                      <DropdownMenuContent>
                        {STATUS_OPTIONS.map(
                          ({ value, label, icon: Icon, className }) => (
                            <DropdownMenuItem
                              key={value}
                              onClick={() => changeStatus(item, value)}
                              className={
                                item.status === value ? "font-medium" : ""
                              }
                            >
                              <Icon className={`h-3.5 w-3.5 ${className}`} />
                              {label}
                            </DropdownMenuItem>
                          ),
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>

                  {/* Title */}
                  <td className="px-3 py-2 max-w-0">
                    <p
                      className={`truncate ${done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {item.title ?? item.description}
                    </p>
                  </td>

                  {/* Assignee */}
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {assignee && assigneeId ? (
                      <Link
                        href={`/team/${assigneeId}`}
                        className="hover:text-foreground hover:underline underline-offset-2 transition-colors"
                      >
                        {assignee.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Due date */}
                  <td
                    className={`flex items-center gap-1 px-3 py-2 whitespace-nowrap ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  >
                    {overdue ? (
                      <MessageSquareWarning className="w-3 h-3" />
                    ) : (
                      ""
                    )}
                    {item.due_date ? (
                      <>{format(parseISO(item.due_date), "MMM d")}</>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5 justify-end">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(item)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ActionItemEditDialog
        key={editingItem?.id ?? "none"}
        item={editingItem}
        members={members}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete action item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingDelete?.title ?? pendingDelete?.description}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
