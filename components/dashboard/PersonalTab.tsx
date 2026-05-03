"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextInput } from "@/components/ui/RichTextInput";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  StickyNote,
  Link2,
  X,
  ExternalLink,
  Clock,
  Plus,
  Pencil,
} from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import type { PersonalItem } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/types";
import { DailyBriefing } from "@/components/dashboard/DailyBriefing";

type ItemType = "note" | "link";

const TYPES: { value: ItemType; label: string; icon: React.ReactNode }[] = [
  { value: "note", label: "Note", icon: <StickyNote className="h-3 w-3" /> },
  { value: "link", label: "Link", icon: <Link2 className="h-3 w-3" /> },
];

function extractText(json: Json): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "";
  const node = json as Record<string, Json>;
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    return (node.content as Json[]).map(extractText).filter(Boolean).join(" ");
  }
  return "";
}

function parseNoteJson(content: string): Json | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed as Json;
    }
  } catch {}
  return null;
}

export function PersonalTab({
  initialItems,
  userId,
}: {
  initialItems: PersonalItem[];
  userId: string;
}) {
  const [items, setItems] = useState<PersonalItem[]>(initialItems);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PersonalItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PersonalItem | null>(null);

  // Form fields
  const [type, setType] = useState<ItemType>("note");
  const [content, setContent] = useState("");
  const [noteJson, setNoteJson] = useState<Json | null>(null);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const changeType = (t: ItemType) => {
    if (t !== "note") setNoteJson(null);
    setType(t);
  };

  const openAdd = () => {
    setEditingItem(null);
    setType("note");
    setContent("");
    setNoteJson(null);
    setUrl("");
    setSheetOpen(true);
  };

  const openEdit = (item: PersonalItem) => {
    if (item.type === "reminder") return;
    setEditingItem(item);
    setType(item.type as ItemType);
    setUrl(item.url ?? "");
    if (item.type === "note") {
      setNoteJson(parseNoteJson(item.content));
      setContent("");
    } else {
      setContent(item.content);
      setNoteJson(null);
    }
    setSheetOpen(true);
  };

  const canSave =
    type === "note"
      ? !!noteJson && !!extractText(noteJson).trim()
      : !!content.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    const contentToSave =
      type === "note" ? JSON.stringify(noteJson) : content.trim();

    const payload = {
      type,
      content: contentToSave,
      url: type === "link" ? url.trim() || null : null,
      due_date: null as string | null,
    };

    const supabase = createClient();

    if (editingItem) {
      const updated: PersonalItem = { ...editingItem, ...payload };
      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? updated : i)),
      );
      setSheetOpen(false);
      const { error } = await supabase
        .from("personal_items")
        .update(payload)
        .eq("id", editingItem.id);
      if (error) {
        toast.error(error.message);
        setItems(initialItems);
      }
    } else {
      const optimistic: PersonalItem = {
        id: crypto.randomUUID(),
        user_id: userId,
        status: "open",
        created_at: new Date().toISOString(),
        ...payload,
      };
      setItems((prev) => [optimistic, ...prev]);
      setSheetOpen(false);
      const { data, error } = await supabase
        .from("personal_items")
        .insert({ user_id: userId, ...payload })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id));
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === optimistic.id ? data : i)),
        );
      }
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setPendingDelete(null);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const supabase = createClient();
    const { error } = await supabase
      .from("personal_items")
      .delete()
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      setItems(initialItems);
    }
  };

  const activeItems = items.filter((i) => i.type !== "todo");

  return (
    <div className="max-w-2xl space-y-4">
      <DailyBriefing userId={userId} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New item
          </Button>
        </div>
      </div>

      {/* Feed */}
      {activeItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Notes, links, and reminders will appear here.
        </p>
      ) : (
        <div className="space-y-2">
          {activeItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingItem ? "Edit item" : "New item"}</SheetTitle>
          </SheetHeader>

          <div className="px-4 space-y-4 flex-1">
            {/* Type selector */}
            <div className="flex gap-1 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => changeType(t.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    type === t.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content — rich text for notes, plain input for rest */}
            {type === "note" ? (
              <RichTextInput
                key={editingItem?.id ?? "new"}
                initialContent={
                  editingItem?.type === "note"
                    ? parseNoteJson(editingItem.content)
                    : null
                }
                onChange={setNoteJson}
                placeholder="Write a note…"
              />
            ) : (
              <Input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="Description or title"
                className="text-sm"
                autoFocus
              />
            )}

            {type === "link" && (
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                className="text-sm"
              />
            )}
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {editingItem ? "Save" : "Add"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingDelete?.type === "note"
              ? "This note will be permanently deleted."
              : pendingDelete?.content}
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
    </div>
  );
}

function NotePreview({ content }: { content: string }) {
  const json = parseNoteJson(content);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [StarterKit],
    content: json ?? undefined,
  });

  if (!json || !editor) {
    return (
      <span className="text-muted-foreground text-xs italic">Empty note</span>
    );
  }

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm dark:prose-invert max-w-none [&_.tiptap]:outline-none"
    />
  );
}

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: PersonalItem;
  onEdit: (item: PersonalItem) => void;
  onDelete: (item: PersonalItem) => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
      {/* Left icon */}
      <div className="mt-0.5 shrink-0">
        {item.type === "note" ? (
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
        ) : item.type === "link" ? (
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {item.due_date && item.type === "reminder" && (
          <DueBadge date={item.due_date} />
        )}
        {item.type === "note" ? (
          <NotePreview content={item.content} />
        ) : item.type === "link" ? (
          <>
            <span>{item.content}</span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex items-center gap-1 text-xs text-blue-500 hover:underline truncate"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.url}</span>
              </a>
            )}
          </>
        ) : (
          <span>{item.content}</span>
        )}
      </div>

      {/* Row actions */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
          title="Delete"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DueBadge({ date }: { date: string }) {
  const parsed = parseISO(date);
  const past = isPast(parsed);
  const today = isToday(parsed);

  const colorClass = past
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : today
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-secondary text-muted-foreground";

  return (
    <span
      className={`mt-1 mr-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${colorClass}`}
    >
      {format(parsed, "MMM d, h:mm a")}
    </span>
  );
}
