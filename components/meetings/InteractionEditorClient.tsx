"use client";

import { useState, useCallback, useRef } from "react";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { ActionItemsSidebar } from "./ActionItemsSidebar";
import { AgendaItemsSidebar } from "./AgendaItemsSidebar";
import { SentimentBadge } from "./SentimentBadge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  Sparkles,
  List,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { CalendarEventPicker } from "@/components/calendar/CalendarEventPicker";
import { format, parseISO } from "date-fns";
import type { ActionItem, AgendaItem } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const INTERACTION_TYPES = [
  { value: "scheduled", label: "Meeting" },
  { value: "incidental", label: "Incidental chat" },
  { value: "note", label: "Quick note" },
  { value: "slack", label: "Slack" },
] as const;

interface InteractionWithMember {
  id: string;
  scheduled_at: string;
  raw_json_notes: Json | null;
  ai_summary: string | null;
  sentiment_score: number | null;
  key_themes: string[];
  title: string | null;
  type: string;
  duration_minutes: number | null;
  google_calendar_event_id: string | null;
  team_members: {
    id: string;
    name: string;
    level: string | null;
    role_description: string | null;
    manager_read: string[] | null;
    is_squad_lead: boolean | null;
    role_id: string | null;
    team_id: string | null;
  } | null;
}

interface Member {
  id: string;
  name: string;
}

interface Props {
  interaction: InteractionWithMember;
  initialActionItems: ActionItem[];
  initialAgendaItems: AgendaItem[];
  allMembers: Member[];
  assignedRole: { id: string; title: string } | null;
  teamName: string | null;
  hasGoogleCalendar: boolean;
}


function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  bordered = true,
  padContent = true,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  bordered?: boolean;
  padContent?: boolean;
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
      {open && <div className={padContent ? "px-4 pb-4" : ""}>{children}</div>}
    </div>
  );
}

export function InteractionEditorClient({
  interaction,
  initialActionItems,
  initialAgendaItems,
  allMembers,
  assignedRole,
  teamName,
  hasGoogleCalendar,
}: Props) {
  const [summary, setSummary] = useState(interaction.ai_summary);
  const [sentiment, setSentiment] = useState(interaction.sentiment_score);
  const [themes, setThemes] = useState<string[]>(interaction.key_themes ?? []);
  const [actionItems, setActionItems] =
    useState<ActionItem[]>(initialActionItems);
  const [agendaItems, setAgendaItems] =
    useState<AgendaItem[]>(initialAgendaItems);
  const [scheduledAt, setScheduledAt] = useState(interaction.scheduled_at);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [title, setTitle] = useState(interaction.title ?? "");
  const [type, setType] = useState(interaction.type ?? "scheduled");
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    interaction.duration_minutes ?? null,
  );
  const [linkedEventId, setLinkedEventId] = useState<string | null>(
    interaction.google_calendar_event_id ?? null,
  );
  const [linkedEventTitle, setLinkedEventTitle] = useState<string | null>(null);
  const [coachingQuestions, setCoachingQuestions] = useState<string[]>([]);
  const [aiTab, setAiTab] = useState("summary");
  const [aiLoading, setAiLoading] = useState<
    "summarize" | "action-items" | "coaching" | null
  >(null);
  const [editorWordCount, setEditorWordCount] = useState(0);
  const [editorSaving, setEditorSaving] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleTitleBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const newTitle = e.target.value.trim();
      const supabase = createClient();
      const { error } = await supabase
        .from("interactions")
        .update({ title: newTitle || null })
        .eq("id", interaction.id);
      if (error) toast.error("Failed to update title");
    },
    [interaction.id],
  );

  const handleDateBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const newDate = e.target.value;
      setIsEditingDate(false);
      if (!newDate || newDate === scheduledAt.slice(0, 10)) return;
      const iso = new Date(newDate + "T12:00:00").toISOString();
      setScheduledAt(iso);
      const supabase = createClient();
      const { error } = await supabase
        .from("interactions")
        .update({ scheduled_at: iso })
        .eq("id", interaction.id);
      if (error) toast.error("Failed to update date");
      else toast.success("Date updated");
    },
    [interaction.id, scheduledAt],
  );

  const handleTypeChange = useCallback(
    async (newType: string) => {
      setType(newType);
      const supabase = createClient();
      const { error } = await supabase
        .from("interactions")
        .update({ type: newType })
        .eq("id", interaction.id);
      if (error) toast.error("Failed to update type");
    },
    [interaction.id],
  );

  const handleDurationBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.target.value.trim();
      const parsed = raw === "" ? null : parseInt(raw, 10);
      const value = parsed !== null && !isNaN(parsed) ? parsed : null;
      setDurationMinutes(value);
      const supabase = createClient();
      const { error } = await supabase
        .from("interactions")
        .update({ duration_minutes: value })
        .eq("id", interaction.id);
      if (error) toast.error("Failed to update duration");
    },
    [interaction.id],
  );

  const refreshActionItems = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("action_items")
      .select("*")
      .eq("interaction_id", interaction.id)
      .order("created_at");
    setActionItems(data ?? []);
  }, [interaction.id]);

  const refreshAgendaItems = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("agenda_items")
      .select("*")
      .eq("interaction_id", interaction.id)
      .order("created_at");
    setAgendaItems(data ?? []);
  }, [interaction.id]);

  const handleSummarize = useCallback(async () => {
    setAiLoading("summarize");
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionId: interaction.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSummary(data.summary);
      setSentiment(data.sentiment);
      setThemes(data.keyThemes ?? []);
      setAiTab("summary");
      toast.success("Summary generated");
    } catch {
      toast.error("Failed to summarize");
    } finally {
      setAiLoading(null);
    }
  }, [interaction.id]);

  const handleExtractItems = useCallback(async () => {
    setAiLoading("action-items");
    try {
      const res = await fetch("/api/ai/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionId: interaction.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      await refreshActionItems();
      setAiTab("actions");
      toast.success(
        `${data.count} action item${data.count !== 1 ? "s" : ""} extracted`,
      );
    } catch {
      toast.error("Failed to extract action items");
    } finally {
      setAiLoading(null);
    }
  }, [interaction.id, refreshActionItems]);

  const handleCoachingQuestions = useCallback(async () => {
    setAiLoading("coaching");
    try {
      const res = await fetch("/api/ai/coaching-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionId: interaction.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCoachingQuestions(data.questions ?? []);
      setAiTab("coaching");
    } catch {
      toast.error("Failed to generate coaching questions");
    } finally {
      setAiLoading(null);
    }
  }, [interaction.id]);

  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("interactions")
      .delete()
      .eq("id", interaction.id);
    setIsDeleting(false);
    if (error) {
      toast.error("Failed to delete interaction");
      return;
    }
    toast.success("Interaction deleted");
    router.push(`/team/${interaction.team_members?.id}`);
  }, [interaction.id, interaction.team_members?.id, router]);

  const member = interaction.team_members;

  return (
    <div className="p-2 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-end mb-2 gap-2">
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground/60">
          <span>{editorSaving ? "Saving…" : "Saved"}</span>
          <span>{editorWordCount} words</span>
        </div>
        <Select
          value={INTERACTION_TYPES.find((i) => i.value === type)?.label}
          onValueChange={(type) => type && handleTypeChange(type)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERACTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More options</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete interaction
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete interaction?</DialogTitle>
            <DialogDescription>
              This will permanently delete the notes, action items, and all
              other data for this interaction. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column */}
        <div className="space-y-4">
          {/* Member name block */}
          <div className="rounded-lg bg-card px-0 pb-5">
            <div>
              <Link href={`/team/${member?.id}`}>
                <h2 className="text-xl font-bold tracking-tight leading-tight">
                  {member?.name ?? "Member"}
                </h2>
              </Link>
              {assignedRole && (
                <div className="mt-0.5">
                  <Link
                    href={`/roles/${assignedRole.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline underline-offset-2"
                  >
                    {assignedRole.title}
                  </Link>
                </div>
              )}
              {(member?.level || teamName || member?.is_squad_lead) && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {member?.level && (
                    <Badge variant="outline" className="capitalize text-xs">
                      {member.level}
                    </Badge>
                  )}
                  {teamName && (
                    <Badge variant="outline" className="text-xs">
                      {teamName}
                    </Badge>
                  )}
                  {member?.is_squad_lead && (
                    <Badge
                      variant="outline"
                      className="text-xs text-primary border-primary/40"
                    >
                      Squad Lead
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {isEditingDate ? (
              <input
                ref={dateInputRef}
                type="date"
                defaultValue={scheduledAt.slice(0, 10)}
                className="text-sm text-muted-foreground bg-transparent border-b border-border focus:outline-none"
                onBlur={handleDateBlur}
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingDate(true)}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
                title="Click to change date"
              >
                {format(parseISO(scheduledAt), "MMM d, yyyy")}
              </button>
            )}
            <div className="flex items-center gap-1">
              <input
                key={durationMinutes}
                type="number"
                min={0}
                max={999}
                defaultValue={durationMinutes ?? ""}
                placeholder="—"
                onBlur={handleDurationBlur}
                className="w-12 text-sm text-muted-foreground bg-transparent border-b border-border focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Duration in minutes"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
            {hasGoogleCalendar && (
              <CalendarEventPicker
                interactionId={interaction.id}
                linkedEventId={linkedEventId}
                linkedEventTitle={linkedEventTitle}
                onLinked={(mins, eventId, eventTitle) => {
                  setDurationMinutes(mins > 0 ? mins : null);
                  setLinkedEventId(eventId);
                  setLinkedEventTitle(eventTitle);
                }}
                onUnlinked={() => {
                  setLinkedEventId(null);
                  setLinkedEventTitle(null);
                }}
              />
            )}
          </div>
          {/* Agenda + My read on + AI actions + Tabs */}
          <div className="rounded-lg border overflow-hidden">
            <CollapsibleSection
              title={<h2 className="text-sm font-semibold">Agenda</h2>}
              defaultOpen
              bordered={false}
            >
              <AgendaItemsSidebar
                interactionId={interaction.id}
                participantId={member?.id ?? ""}
                items={agendaItems}
                onUpdate={refreshAgendaItems}
              />
            </CollapsibleSection>

            {/* Tabs: Summary | Action Items | Coaching */}
            <div className="border-t">
              <div className="flex justify-between px-4 pt-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Insights</h2>
                  <SentimentBadge score={sentiment} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                    disabled={aiLoading !== null}
                  >
                    Generate
                    {aiLoading !== null ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={handleSummarize}
                      disabled={aiLoading !== null}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Summarize
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExtractItems}
                      disabled={aiLoading !== null}
                    >
                      <List className="h-3.5 w-3.5" />
                      Extract action items
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleCoachingQuestions}
                      disabled={aiLoading !== null}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Coaching questions
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Tabs value={aiTab} onValueChange={(v) => setAiTab(v as string)}>
                <div className="px-3 pt-3">
                  <TabsList className="p-0.5">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                    <TabsTrigger value="coaching">Coaching</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="summary" className="px-4 py-3">
                  {summary ? (
                    <div className="space-y-3">
                      <p className="text-sm">{summary}</p>
                      {themes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {themes.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-xs"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No summary yet. Use the AI dropdown next to the title.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="actions">
                  <ActionItemsSidebar
                    interactionId={interaction.id}
                    items={actionItems}
                    allMembers={allMembers}
                    onUpdate={refreshActionItems}
                  />
                </TabsContent>

                <TabsContent value="coaching" className="px-4 py-3">
                  {coachingQuestions.length > 0 ? (
                    <ol className="space-y-2">
                      {coachingQuestions.map((q, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-muted-foreground shrink-0">
                            {i + 1}.
                          </span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No coaching questions yet. Use the AI dropdown next to the
                      title.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Right column — title + editor */}
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Untitled interaction"
              className="flex-1 text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 text-foreground"
            />
          </div>
          <TiptapEditor
            interactionId={interaction.id}
            initialContent={interaction.raw_json_notes}
            onStatsChange={({ wordCount, saving }) => {
              setEditorWordCount(wordCount);
              setEditorSaving(saving);
            }}
          />
        </div>
      </div>
    </div>
  );
}
