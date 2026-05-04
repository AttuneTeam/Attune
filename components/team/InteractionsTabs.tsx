"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, Clock, Circle, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteInteractionButton } from "@/components/team/DeleteInteractionButton";
import { toast } from "sonner";
import { Badge } from "../ui/badge";

type InteractionRow = {
  id: string;
  title: string | null;
  scheduled_at: string;
  sentiment_score: number | null;
  ai_summary: string | null;
  key_themes: string[];
  type: string;
};

type ActionItem = {
  id: string;
  description: string;
  status: string;
  due_date: string | null;
  interaction_id: string | null;
};

function sentimentBadge(score: number): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (score >= 0.3) return { label: "Positive", variant: "default" };
  if (score >= -0.3) return { label: "Neutral", variant: "secondary" };
  return { label: "Concerning", variant: "destructive" };
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
] as const;

function StatusIcon({ status }: { status: string }) {
  const opt =
    STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
  const Icon = opt.icon;
  return <Icon className={`h-3.5 w-3.5 ${opt.className}`} />;
}

function EditActionItemDialog({
  item,
  onSave,
  onClose,
}: {
  item: ActionItem;
  onSave: (updated: ActionItem) => void;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(item.description);
  const [status, setStatus] = useState(item.status);
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          status,
          due_date: dueDate || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
        return;
      }
      onSave({ ...item, description, status, due_date: dueDate || null });
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Edit action item</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Due date
            </label>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface Props {
  interactions: InteractionRow[];
  items: ActionItem[];
}

export function InteractionsTabs({ interactions, items: initialItems }: Props) {
  const [items, setItems] = useState<ActionItem[]>(initialItems);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);

  const openCount = items.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  ).length;

  const sorted = [
    ...items.filter((i) => i.status === "open"),
    ...items.filter((i) => i.status === "in_progress"),
    ...items.filter((i) => i.status === "done"),
  ];

  function handleSave(updated: ActionItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function changeStatus(item: ActionItem, newStatus: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
    );
    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to update status");
        setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      }
    } catch {
      toast.error("Something went wrong");
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    }
  }

  return (
    <>
      <Tabs defaultValue="interactions">
        <TabsList className="p-0.5">
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="action-items">
            Actions
            {openCount > 0 && (
              <span className="ml-1.5 rounded-full bg-secondary text-primary px-1.5 py-0 text-[10px] font-medium">
                {openCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Interactions tab */}
        <TabsContent value="interactions">
          <div className="rounded-lg bg-card mt-2">
            {interactions.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No interactions yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use "New interaction" above to get started.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {interactions.map((interaction) => {
                  const badge =
                    interaction.sentiment_score !== null
                      ? sentimentBadge(interaction.sentiment_score)
                      : null;
                  return (
                    <div
                      key={interaction.id}
                      className="group flex items-start gap-2 pr-3 hover:bg-muted/30 transition-colors"
                    >
                      <Link
                        href={`/interactions/${interaction.id}`}
                        className="flex flex-1 min-w-0 items-start gap-4 px-0 py-4"
                      >
                        <div className="shrink-0 text-center px-2 py-1 border border-dashed border-secondary rounded-md">
                          <p className="text-sm font-medium tabular-nums">
                            {format(
                              parseISO(interaction.scheduled_at),
                              "MMM d",
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(interaction.scheduled_at), "yyyy")}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">
                              {interaction.title ?? "Untitled interaction"}
                            </p>
                          </div>
                          {interaction.ai_summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {interaction.ai_summary}
                            </p>
                          )}
                          {interaction.key_themes &&
                            interaction.key_themes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {interaction.key_themes
                                  .slice(0, 4)
                                  .map((theme) => (
                                    <Badge
                                      key={theme}
                                      variant="outline"
                                      className="text-xs px-1.5 py-0"
                                    >
                                      {theme}
                                    </Badge>
                                  ))}
                              </div>
                            )}
                        </div>
                      </Link>
                      <div className="flex items-center self-stretch py-4">
                        <DeleteInteractionButton
                          interactionId={interaction.id}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Action items tab */}
        <TabsContent value="action-items">
          {items.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No action items yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Use "Extract items" in an interaction to generate them
                automatically.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Task
                    </th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                      Due
                    </th>
                    <th className="px-3 py-2 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-card">
                  {sorted.map((item) => {
                    const done = item.status === "done";
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
                                    <Icon
                                      className={`h-3.5 w-3.5 ${className}`}
                                    />
                                    {label}
                                  </DropdownMenuItem>
                                ),
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>

                        {/* Description */}
                        <td className="px-3 py-2 max-w-0">
                          <p
                            className={`truncate ${done ? "line-through text-muted-foreground" : ""}`}
                          >
                            {item.description}
                          </p>
                        </td>

                        {/* Due date — hidden on mobile */}
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                          {item.due_date
                            ? format(parseISO(item.due_date), "MMM d")
                            : "—"}
                        </td>

                        {/* Edit */}
                        <td className="px-3 py-2">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
      >
        {editingItem && (
          <EditActionItemDialog
            item={editingItem}
            onSave={handleSave}
            onClose={() => setEditingItem(null)}
          />
        )}
      </Dialog>
    </>
  );
}
