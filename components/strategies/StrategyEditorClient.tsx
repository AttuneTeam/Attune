"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StrategyTiptapEditor } from "./StrategyTiptapEditor";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  ExternalLink,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import type { StrategicInitiative } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const STATUS_CYCLE: Record<string, string> = {
  active: "paused",
  paused: "completed",
  completed: "archived",
  archived: "active",
};

const STATUS_COLORS: Record<string, string> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
  archived: "secondary",
};

const HORIZON_OPTIONS = ["Quarterly", "Annual", "Multi-year", "Ongoing"];

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  bordered = true,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  bordered?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={bordered ? "border-t" : ""}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/30 transition-colors"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform text-muted-foreground ${!open ? "-rotate-90" : ""}`}
        />
        {title}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function SubInitiativeList({
  parentId,
  parentDepth,
}: {
  parentId: string;
  parentDepth: number;
}) {
  const [children, setChildren] = useState<StrategicInitiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("strategic_initiatives")
      .select("id, title, status, updated_at, depth, parent_id, manager_id, description, tags, domain, horizon, source_chat_id, created_at")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setChildren((data ?? []) as StrategicInitiative[]);
        setLoading(false);
      });
  }, [parentId]);

  const handleCreate = async () => {
    setCreating(true);
    const res = await fetch("/api/initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: parentId }),
    });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/initiatives/${id}`);
    }
    setCreating(false);
  };

  if (loading)
    return <p className="text-xs text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-1.5">
      {children.map((child) => (
        <Link
          key={child.id}
          href={`/initiatives/${child.id}`}
          className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors"
        >
          <span className="truncate">{child.title}</span>
          <Badge
            variant={
              STATUS_COLORS[child.status] as
                | "default"
                | "secondary"
                | "outline"
                | "destructive"
            }
            className="ml-2 shrink-0 text-[10px]"
          >
            {child.status}
          </Badge>
        </Link>
      ))}
      {parentDepth < 2 && (
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <Plus className="h-3 w-3" />
          {creating ? "Creating…" : "Add sub-initiative"}
        </button>
      )}
    </div>
  );
}

export function StrategyEditorClient({
  initiative,
  parent,
}: {
  initiative: StrategicInitiative;
  parent: StrategicInitiative | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initiative.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState(initiative.status);
  const [tags, setTags] = useState<string[]>(initiative.tags ?? []);
  const [domain, setDomain] = useState(initiative.domain ?? "");
  const [horizon, setHorizon] = useState(initiative.horizon ?? "");
  const [tagInput, setTagInput] = useState("");

  const saveField = useCallback(
    async (fields: Partial<StrategicInitiative>) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("strategic_initiatives")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", initiative.id);
      if (error) toast.error("Failed to save");
    },
    [initiative.id],
  );

  const handleTitleBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const newTitle = e.target.value.trim() || "Untitled Initiative";
      await saveField({ title: newTitle });
    },
    [saveField],
  );

  const cycleStatus = useCallback(async () => {
    const next = STATUS_CYCLE[status] ?? "active";
    setStatus(next as StrategicInitiative["status"]);
    await saveField({ status: next as StrategicInitiative["status"] });
  }, [status, saveField]);

  const addTag = useCallback(
    async (raw: string) => {
      const newTags = raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t && !tags.includes(t));
      if (newTags.length === 0) return;
      const updated = [...tags, ...newTags];
      setTags(updated);
      setTagInput("");
      await saveField({ tags: updated });
    },
    [tags, saveField],
  );

  const removeTag = useCallback(
    async (tag: string) => {
      const updated = tags.filter((t) => t !== tag);
      setTags(updated);
      await saveField({ tags: updated });
    },
    [tags, saveField],
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    const res = await fetch(`/api/initiatives/${initiative.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete initiative");
      setDeleting(false);
      return;
    }
    router.push(parent ? `/initiatives/${parent.id}` : "/initiatives");
  }, [initiative.id, parent, router]);

  const handleDomainBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const val = e.target.value.trim();
      setDomain(val);
      await saveField({ domain: val || null });
    },
    [saveField],
  );

  const handleHorizonChange = useCallback(
    async (val: string) => {
      setHorizon(val);
      await saveField({ horizon: val || null });
    },
    [saveField],
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back / breadcrumb */}
      <div className="px-8 mb-4 flex justify-between">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link
            href="/initiatives"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Initiatives
          </Link>
          {parent && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link
                href={`/initiatives/${parent.id}`}
                className="hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                {parent.title}
              </Link>
            </>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={cycleStatus} title="Click to cycle status">
            <Badge
              variant={
                STATUS_COLORS[status] as
                  | "default"
                  | "secondary"
                  | "outline"
                  | "destructive"
              }
            >
              {status}
            </Badge>
          </button>
          <span className="text-xs text-muted-foreground">
            {format(new Date(initiative.created_at), "MMM d, yyyy")}
          </span>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon-sm" title="Properties" />
                }
              >
                <MoreHorizontal className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent className="gap-0 overflow-y-auto">
                <div className="px-4 pt-4 pb-3 border-b">
                  <SheetTitle>Properties</SheetTitle>
                </div>

                {/* Tags */}
                <CollapsibleSection
                  title="Tags"
                  defaultOpen={true}
                  bordered={false}
                >
                  <div className="space-y-2">
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-medium"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addTag(tagInput);
                          }
                        }}
                        placeholder="Add tag…"
                        className="h-7 text-xs"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => addTag(tagInput)}
                        disabled={!tagInput.trim()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Enter or comma to add multiple
                    </p>
                  </div>
                </CollapsibleSection>

                {/* Details */}
                <CollapsibleSection title="Details" defaultOpen={true}>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Domain
                      </label>
                      <Input
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        onBlur={handleDomainBlur}
                        placeholder="e.g. Engineering, People…"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Horizon
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {HORIZON_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              handleHorizonChange(horizon === opt ? "" : opt)
                            }
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              horizon === opt
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Sub-initiatives */}
                {initiative.depth < 2 && (
                  <CollapsibleSection title="Sub-initiatives" defaultOpen={true}>
                    <SubInitiativeList
                      parentId={initiative.id}
                      parentDepth={initiative.depth}
                    />
                  </CollapsibleSection>
                )}

                {/* Source conversation */}
                {initiative.source_chat_id && (
                  <CollapsibleSection title="Source" defaultOpen={true}>
                    <a
                      href={`/?conversation=${initiative.source_chat_id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View source conversation
                    </a>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Opens in the AI chat panel
                    </p>
                  </CollapsibleSection>
                )}

                {/* Delete */}
                <div className="border-t px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete initiative
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="px-8 flex items-start gap-3 mb-4">
        <input
          className="flex-1 text-xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground min-w-0"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Initiative title"
        />
      </div>

      {/* Editor */}
      <div className="bg-card flex flex-col">
        <StrategyTiptapEditor
          initiativeId={initiative.id}
          initialContent={initiative.description}
        />
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(false);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete initiative?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{title}</span> will be
            permanently deleted.
            {initiative.depth < 2 && " Sub-initiatives will also be deleted."}
            {" "}This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
