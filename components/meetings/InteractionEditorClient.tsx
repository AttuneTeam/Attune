"use client";

import { useState, useCallback, useRef } from "react";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { ActionItemsSidebar } from "./ActionItemsSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { ChevronLeft, PanelRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ActionItem } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const INTERACTION_TYPES = [
  { value: "scheduled", label: "Scheduled meeting" },
  { value: "incidental", label: "Incidental chat" },
  { value: "note", label: "Quick note" },
  { value: "slack", label: "Slack interaction" },
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
  team_members: {
    id: string;
    name: string;
    level: string | null;
    role_description: string | null;
  } | null;
}

interface Member {
  id: string;
  name: string;
}

interface Props {
  interaction: InteractionWithMember;
  initialActionItems: ActionItem[];
  allMembers: Member[];
}

function sentimentColor(score: number | null) {
  if (score === null) return "secondary";
  if (score >= 0.3) return "default";
  if (score >= -0.3) return "secondary";
  return "destructive";
}

export function InteractionEditorClient({
  interaction,
  initialActionItems,
  allMembers,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [summary, setSummary] = useState(interaction.ai_summary);
  const [sentiment, setSentiment] = useState(interaction.sentiment_score);
  const [themes, setThemes] = useState<string[]>(interaction.key_themes ?? []);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialActionItems);
  const [scheduledAt, setScheduledAt] = useState(interaction.scheduled_at);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [title, setTitle] = useState(interaction.title ?? "");
  const [type, setType] = useState(interaction.type ?? "scheduled");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleSummaryUpdate = useCallback(
    (newSummary: string, newSentiment: number, newThemes: string[]) => {
      setSummary(newSummary);
      setSentiment(newSentiment);
      setThemes(newThemes);
    },
    [],
  );

  const handleTitleBlur = useCallback(async (e: React.FocusEvent<HTMLInputElement>) => {
    const newTitle = e.target.value.trim();
    const supabase = createClient();
    const { error } = await supabase
      .from("interactions")
      .update({ title: newTitle || null })
      .eq("id", interaction.id);
    if (error) toast.error("Failed to update title");
  }, [interaction.id]);

  const handleDateBlur = useCallback(async (e: React.FocusEvent<HTMLInputElement>) => {
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
  }, [interaction.id, scheduledAt]);

  const handleTypeChange = useCallback(async (newType: string) => {
    setType(newType);
    const supabase = createClient();
    const { error } = await supabase
      .from("interactions")
      .update({ type: newType })
      .eq("id", interaction.id);
    if (error) toast.error("Failed to update type");
  }, [interaction.id]);

  const refreshActionItems = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("action_items")
      .select("*")
      .eq("interaction_id", interaction.id)
      .order("created_at");
    setActionItems(data ?? []);
  }, [interaction.id]);

  const member = interaction.team_members;

  return (
    <div className="flex h-full">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b flex items-center px-4 gap-3 shrink-0">
          <Link
            href={member ? `/team/${member.id}` : '/interactions'}
            className="inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">
                {member?.name ?? "Interaction"}
              </span>
              {member?.level && (
                <Badge
                  variant="secondary"
                  className="text-xs capitalize hidden sm:flex"
                >
                  {member.level}
                </Badge>
              )}
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-6 text-xs border-0 bg-transparent px-1.5 gap-1 hover:bg-muted w-auto focus:ring-0 focus:ring-offset-0">
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
            </div>
          </div>
          {sentiment !== null && (
            <Badge
              variant={sentimentColor(sentiment)}
              className="text-xs shrink-0"
            >
              {sentiment > 0 ? "+" : ""}
              {sentiment.toFixed(2)}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </header>

        {/* Title */}
        <div className="px-8 pt-5 pb-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Untitled interaction"
            className="w-full text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 text-foreground"
          />
        </div>

        {/* Summary bar (if exists) */}
        {summary && (
          <div className="px-8 py-3 bg-muted/30 border-b">
            <p className="text-xs text-muted-foreground font-medium mb-1">
              AI Summary
            </p>
            <p className="text-sm">{summary}</p>
            {themes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {themes.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <TiptapEditor
            interactionId={interaction.id}
            initialContent={interaction.raw_json_notes}
            onSummaryUpdate={handleSummaryUpdate}
            onActionItemsUpdate={refreshActionItems}
          />
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-72 border-l flex flex-col shrink-0 overflow-hidden">
          <ActionItemsSidebar
            interactionId={interaction.id}
            items={actionItems}
            allMembers={allMembers}
            onUpdate={refreshActionItems}
          />
        </div>
      )}
    </div>
  );
}
