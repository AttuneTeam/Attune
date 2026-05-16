"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { Plus, Check, Clock, Circle, Pencil, Trash2 } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import type { ActionItem } from "@/lib/supabase/types";
import {
  ActionItemEditDialog,
  type ActionItemUpdates,
} from "@/components/action-items/ActionItemEditDialog";
import { SwipeableActionRow } from "@/components/action-items/SwipeableActionRow";

const STATUS_OPTIONS = [
  { value: "open", label: "Open", icon: Circle, className: "text-muted-foreground" },
  { value: "in_progress", label: "In progress", icon: Clock, className: "text-amber-500" },
  { value: "done", label: "Done", icon: Check, className: "text-green-500" },
] as const;

const StatusIcon = ({ status }: { status: string }) => {
  const opt = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
  const Icon = opt.icon;
  return <Icon className={`h-3.5 w-3.5 ${opt.className}`} />;
};

interface Member {
  id: string;
  name: string;
}
interface Props {
  interactionId: string;
  items: ActionItem[];
  allMembers: Member[];
  onUpdate: () => void;
}

export function ActionItemsSidebar({
  interactionId,
  items,
  allMembers,
  onUpdate,
}: Props) {
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ActionItem | null>(null);
  const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) return;
    setAdding(true);
    const supabase = createClient();
    const { error } = await supabase.from("action_items").insert({
      interaction_id: interactionId,
      description: newDesc.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      setNewDesc("");
      onUpdate();
    }
    setAdding(false);
  };

  const changeStatus = async (item: ActionItem, newStatus: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .update({ status: newStatus })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
    } else {
      onUpdate();
    }
  };

  const handleSaveEdit = async (updates: ActionItemUpdates) => {
    if (!editingItem) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .update(updates)
      .eq("id", editingItem.id);
    if (error) {
      toast.error(error.message);
    } else {
      setEditingItem(null);
      onUpdate();
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("action_items")
      .delete()
      .eq("id", deletingItem.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Action item deleted");
      setDeletingItem(null);
      onUpdate();
    }
  };

  const open = items.filter((i) => i.status === "open");
  const inProgress = items.filter((i) => i.status === "in_progress");
  const done = items.filter((i) => i.status === "done");
  const sorted = [...open, ...inProgress, ...done];

  const empty = (
    <p className="text-xs text-muted-foreground text-center py-8">
      No action items yet.
      <br />
      Use &ldquo;Extract items&rdquo; or add one below.
    </p>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-3">{empty}</div>
        ) : (
          <>
            {/* ── Mobile swipeable list (≤ 720px) ── */}
            <div className="min-[721px]:hidden bg-card">
              {sorted.map((item) => {
                const isDone = item.status === "done";
                const overdue = !isDone && item.due_date && isPast(parseISO(item.due_date));
                return (
                  <SwipeableActionRow
                    key={item.id}
                    rowId={item.id}
                    activeSwipeId={activeSwipeId}
                    setActiveSwipeId={setActiveSwipeId}
                    onEdit={() => setEditingItem(item)}
                    onDeleteRequest={() => setDeletingItem(item)}
                  >
                    <div className={`flex items-start gap-2 px-3 py-2.5 ${isDone ? "opacity-50" : ""}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button className="mt-0.5 shrink-0 p-0.5 rounded" title="Change status">
                              <StatusIcon status={item.status} />
                            </button>
                          }
                        />
                        <DropdownMenuContent>
                          {STATUS_OPTIONS.map(({ value, label, icon: Icon, className }) => (
                            <DropdownMenuItem
                              key={value}
                              onClick={() => changeStatus(item, value)}
                              className={item.status === value ? "font-medium" : ""}
                            >
                              <Icon className={`h-3.5 w-3.5 ${className}`} />
                              {label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="flex-1 min-w-0">
                        {item.title ? (
                          <>
                            <p className={`text-xs font-medium leading-relaxed ${isDone ? "line-through" : ""}`}>
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed truncate">
                              {item.description}
                            </p>
                          </>
                        ) : (
                          <p className={`text-xs leading-relaxed ${isDone ? "line-through" : ""}`}>
                            {item.description}
                          </p>
                        )}
                        {item.due_date && (
                          <p className={`text-xs mt-0.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            Due {format(parseISO(item.due_date), "MMM d")}
                            {overdue ? " (overdue)" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </SwipeableActionRow>
                );
              })}
            </div>

            {/* ── Desktop hover list (> 720px) ── */}
            <div className="hidden min-[721px]:block p-3 space-y-1">
              {sorted.map((item) => {
                const isDone = item.status === "done";
                const overdue = !isDone && item.due_date && isPast(parseISO(item.due_date));
                return (
                  <div
                    key={item.id}
                    className={`group flex gap-2 p-2 rounded-md hover:bg-accent/30 transition-colors ${isDone ? "opacity-50" : ""}`}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button className="mt-0.5 shrink-0 hover:opacity-70 p-0.5 rounded" title="Change status">
                            <StatusIcon status={item.status} />
                          </button>
                        }
                      />
                      <DropdownMenuContent>
                        {STATUS_OPTIONS.map(({ value, label, icon: Icon, className }) => (
                          <DropdownMenuItem
                            key={value}
                            onClick={() => changeStatus(item, value)}
                            className={item.status === value ? "font-medium" : ""}
                          >
                            <Icon className={`h-3.5 w-3.5 ${className}`} />
                            {label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex-1 min-w-0">
                      {item.title ? (
                        <>
                          <p className={`text-xs font-medium leading-relaxed ${isDone ? "line-through" : ""}`}>
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed truncate">
                            {item.description}
                          </p>
                        </>
                      ) : (
                        <p className={`text-xs leading-relaxed ${isDone ? "line-through" : ""}`}>
                          {item.description}
                        </p>
                      )}
                      {item.due_date && (
                        <p className={`text-xs mt-0.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          Due {format(parseISO(item.due_date), "MMM d")}
                          {overdue ? " (overdue)" : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => setEditingItem(item)} className="hover:opacity-70" title="Edit">
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => setDeletingItem(item)} className="hover:opacity-70" title="Delete">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add new */}
      <div className="border-t p-3">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Add action item…"
            className="text-xs h-8"
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={adding}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      <ActionItemEditDialog
        key={editingItem?.id ?? "none"}
        item={editingItem}
        members={allMembers}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />

      <Dialog open={!!deletingItem} onOpenChange={(open) => { if (!open) setDeletingItem(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete action item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deletingItem?.title ?? deletingItem?.description}
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
