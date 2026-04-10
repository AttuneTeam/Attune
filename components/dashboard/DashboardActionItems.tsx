"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { format, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Circle,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";

const STATUS_CYCLE: Record<string, string> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export interface DashboardActionItem {
  id: string;
  description: string;
  status: string;
  due_date: string | null;
  created_at: string;
  interactions: {
    id: string;
    team_members: { id: string; name: string } | null;
  } | null;
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "done")
    return <Check className="h-3.5 w-3.5 text-green-500" />;
  if (status === "in_progress")
    return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
};

export function DashboardActionItems({
  items: initialItems,
}: {
  items: DashboardActionItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [pendingDelete, setPendingDelete] =
    useState<DashboardActionItem | null>(null);
  const [editingItem, setEditingItem] = useState<DashboardActionItem | null>(
    null,
  );
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const openEdit = (item: DashboardActionItem) => {
    setEditingItem(item);
    setEditDescription(item.description);
    setEditDueDate(item.due_date ?? "");
    setEditStatus(item.status);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    setSaving(true);
    const updates = {
      description: editDescription.trim(),
      due_date: editDueDate || null,
      status: editStatus,
    };
    setItems((prev) =>
      prev.map((i) => (i.id === editingItem.id ? { ...i, ...updates } : i)),
    );
    setEditingItem(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .update(updates)
      .eq("id", editingItem.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      setItems(initialItems);
    } else {
      router.refresh();
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setPendingDelete(null);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .delete()
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      setItems(initialItems);
    } else {
      router.refresh();
    }
  };

  const cycleStatus = async (item: DashboardActionItem) => {
    const newStatus = STATUS_CYCLE[item.status] ?? "open";
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .update({ status: newStatus })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      setItems(initialItems);
    } else {
      router.refresh();
    }
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1">
        No open action items.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-7 px-2 py-1.5" />
              <th className="text-left font-medium text-muted-foreground w-20">
                Due
              </th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                Description
              </th>
              <th className="w-24 text-left px-2 py-1.5 font-medium text-muted-foreground hidden sm:table-cell">
                Person
              </th>
              <th className="w-16 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => {
              const overdue =
                item.status !== "done" &&
                item.due_date &&
                isPast(parseISO(item.due_date));
              return (
                <tr
                  key={item.id}
                  className={`hover:bg-muted/40 transition-colors ${item.status === "done" ? "opacity-40" : ""}`}
                >
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => cycleStatus(item)}
                      className="hover:opacity-70 flex items-center"
                    >
                      <StatusIcon status={item.status} />
                    </button>
                  </td>
                  <td>
                    {item.due_date
                      ? format(parseISO(item.due_date), "MMM d")
                      : "—"}
                  </td>
                  <td
                    className={`px-2 py-1.5 max-w-0 ${item.status === "done" ? "line-through text-muted-foreground" : ""}`}
                  >
                    <span className="block truncate">{item.description}</span>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    {`${item.interactions?.team_members?.name ?? "—"}`}
                  </td>

                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-0.5 justify-end">
                      {item.interactions?.id && (
                        <Link
                          href={`/interactions/${item.interactions.id}`}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="View interaction"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(item)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
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

      {/* Edit dialog */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit action item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Description
              </label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Due date
              </label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditStatus(opt.value)}
                    className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium transition-colors ${
                      editStatus === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent border-border"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={saving || !editDescription.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
            {pendingDelete?.description}
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
