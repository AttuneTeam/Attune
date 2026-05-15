"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { cn } from "@/lib/utils";
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
  { value: "open", label: "Open", icon: Circle, className: "text-muted-foreground" },
  { value: "in_progress", label: "In progress", icon: Clock, className: "text-amber-500" },
  { value: "done", label: "Done", icon: Check, className: "text-green-500" },
];

function StatusIcon({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
  const Icon = opt.icon;
  return <Icon className={`h-3.5 w-3.5 ${opt.className}`} />;
}

const ACTION_WIDTH = 68;
const SNAP_THRESHOLD = ACTION_WIDTH * 0.45;

function SwipeableRow({
  item,
  members,
  activeSwipeId,
  setActiveSwipeId,
  onEdit,
  onDeleteRequest,
  onStatusChange,
}: {
  item: ActionItemRow;
  members: Member[];
  activeSwipeId: string | null;
  setActiveSwipeId: (id: string | null) => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onStatusChange: (status: string) => void;
}) {
  const touchStartX = useRef(0);
  const baseOffset = useRef(0);
  const [displayOffset, setDisplayOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const done = item.status === "done";
  const overdue = !done && item.due_date && isPast(parseISO(item.due_date));
  const assignee = item.assignee_id ? members.find((m) => m.id === item.assignee_id) : null;
  const assigneeId = item.assignee_id ?? null;

  // Close when another row is swiped open
  useEffect(() => {
    if (activeSwipeId && !activeSwipeId.startsWith(item.id)) {
      setTransitioning(true);
      baseOffset.current = 0;
      setDisplayOffset(0);
    }
  }, [activeSwipeId, item.id]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setTransitioning(false);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const raw = baseOffset.current + dx;
    setDisplayOffset(Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, raw)));
  }

  function handleTouchEnd() {
    setTransitioning(true);
    if (displayOffset < -SNAP_THRESHOLD) {
      baseOffset.current = -ACTION_WIDTH;
      setDisplayOffset(-ACTION_WIDTH);
      setActiveSwipeId(`${item.id}:left`);
    } else if (displayOffset > SNAP_THRESHOLD) {
      baseOffset.current = ACTION_WIDTH;
      setDisplayOffset(ACTION_WIDTH);
      setActiveSwipeId(`${item.id}:right`);
    } else {
      baseOffset.current = 0;
      setDisplayOffset(0);
      setActiveSwipeId(null);
    }
  }

  function closeSwipe() {
    setTransitioning(true);
    baseOffset.current = 0;
    setDisplayOffset(0);
    setActiveSwipeId(null);
  }

  return (
    <div className="relative overflow-hidden border-b last:border-0">
      {/* Edit action — revealed by swipe right */}
      <div className="absolute left-0 inset-y-0 w-[68px] bg-accent flex items-center justify-center">
        <button
          type="button"
          onClick={() => { closeSwipe(); onEdit(); }}
          className="flex flex-col items-center gap-1 text-foreground"
          aria-label="Edit"
        >
          <Pencil className="h-5 w-5" />
          <span className="text-[10px] font-medium">Edit</span>
        </button>
      </div>

      {/* Delete action — revealed by swipe left */}
      <div className="absolute right-0 inset-y-0 w-[68px] bg-destructive flex items-center justify-center">
        <button
          type="button"
          onClick={() => { closeSwipe(); onDeleteRequest(); }}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Delete"
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </div>

      {/* Row content */}
      <div
        style={{
          transform: `translateX(${displayOffset}px)`,
          touchAction: "pan-y",
        }}
        className={cn(
          "relative bg-card flex items-start gap-3 px-4 py-3",
          transitioning && "transition-transform duration-200",
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => displayOffset !== 0 && closeSwipe()}
      >
        {/* Status toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="mt-0.5 p-0.5 rounded hover:bg-muted shrink-0"
                title="Change status"
              >
                <StatusIcon status={item.status} />
              </button>
            }
          />
          <DropdownMenuContent>
            {STATUS_OPTIONS.map(({ value, label, icon: Icon, className }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => onStatusChange(value)}
                className={item.status === value ? "font-medium" : ""}
              >
                <Icon className={`h-3.5 w-3.5 ${className}`} />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {item.title ? (
            <>
              <p className={cn("text-sm font-medium truncate", done && "line-through text-muted-foreground")}>
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {item.description}
              </p>
            </>
          ) : (
            <p className={cn("text-sm", done && "line-through text-muted-foreground")}>
              {item.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.due_date && (
              <span className={cn("text-xs flex items-center gap-0.5", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                {overdue && <MessageSquareWarning className="h-3 w-3" />}
                {format(parseISO(item.due_date), "MMM d")}
              </span>
            )}
            {assignee && assigneeId && (
              <Link
                href={`/team/${assigneeId}`}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                {assignee.name}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
  const [pendingDelete, setPendingDelete] = useState<ActionItemRow | null>(null);
  const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleSaveEdit = async (updates: ActionItemUpdates) => {
    if (!editingItem) return;
    const id = editingItem.id;
    setLocalItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    const supabase = createClient();
    const { error } = await supabase.from("action_items").update(updates).eq("id", id);
    if (error) {
      toast.error(error.message);
      setLocalItems(items);
    } else {
      setEditingItem(null);
      router.refresh();
    }
  };

  const changeStatus = async (item: ActionItemRow, newStatus: string) => {
    setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
    const supabase = createClient();
    const { error } = await supabase.from("action_items").update({ status: newStatus }).eq("id", item.id);
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
    const { error } = await supabase.from("action_items").delete().eq("id", item.id);
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
      {/* ── Desktop table (> 720px) ── */}
      <div className="hidden min-[721px]:block rounded-lg border overflow-hidden">
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
              const overdue = !done && item.due_date && isPast(parseISO(item.due_date));
              const assignee = item.assignee_id ? members.find((m) => m.id === item.assignee_id) : null;
              const assigneeId = item.assignee_id ?? null;

              return (
                <tr key={item.id} className={`hover:bg-muted/30 transition-colors ${done ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button className="p-0.5 rounded hover:bg-muted flex items-center justify-center" title="Change status">
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
                  </td>
                  <td className="px-3 py-2 max-w-0">
                    {item.title ? (
                      <>
                        <p className={`truncate font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                          {item.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </>
                    ) : (
                      <p className={`truncate ${done ? "line-through text-muted-foreground" : ""}`}>
                        {item.description}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {assignee && assigneeId ? (
                      <Link href={`/team/${assigneeId}`} className="hover:text-foreground hover:underline underline-offset-2 transition-colors">
                        {assignee.name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className={`flex items-center gap-1 px-3 py-2 whitespace-nowrap ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {overdue && <MessageSquareWarning className="w-3 h-3" />}
                    {item.due_date ? format(parseISO(item.due_date), "MMM d") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5 justify-end">
                      <button onClick={() => setEditingItem(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => setPendingDelete(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="Delete">
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

      {/* ── Mobile list (≤ 720px) ── */}
      <div className="min-[721px]:hidden rounded-lg border overflow-hidden bg-card">
        {localItems.map((item) => (
          <SwipeableRow
            key={item.id}
            item={item}
            members={members}
            activeSwipeId={activeSwipeId}
            setActiveSwipeId={setActiveSwipeId}
            onEdit={() => setEditingItem(item)}
            onDeleteRequest={() => setPendingDelete(item)}
            onStatusChange={(status) => changeStatus(item, status)}
          />
        ))}
      </div>

      {/* ── Shared dialogs ── */}
      <ActionItemEditDialog
        key={editingItem?.id ?? "none"}
        item={editingItem}
        members={members}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete action item?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.title ?? pendingDelete?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
