"use client";

import { useEffect, useRef } from "react";
import { Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";

export type AgentLogEntry =
  | { type: "thinking"; content: string }
  | { type: "tool_call"; toolCallId: string; toolName: string }
  | { type: "tool_result"; toolCallId: string; toolName: string; result: unknown };

const TOOL_LABELS: Record<string, string> = {
  summarize_interaction: "Summarizing interaction",
  extract_action_items: "Extracting action items",
  generate_coaching_questions: "Generating coaching questions",
  check_sentiment_history: "Checking sentiment history",
  create_escalation_reminder: "Creating escalation reminder",
};

function toolResultSummary(toolName: string, result: unknown): string {
  const r = result as Record<string, unknown>;
  switch (toolName) {
    case "summarize_interaction": {
      const sentiment =
        typeof r.sentiment === "number" ? r.sentiment.toFixed(2) : "—";
      const themes = Array.isArray(r.keyThemes) ? (r.keyThemes as string[]).join(", ") : "";
      return `Sentiment ${sentiment}${themes ? ` · ${themes}` : ""}`;
    }
    case "extract_action_items": {
      const ind = (r.individualCount as number) ?? 0;
      const mgr = (r.managerCount as number) ?? 0;
      const parts = [];
      if (ind > 0) parts.push(`${ind} individual`);
      if (mgr > 0) parts.push(`${mgr} yours`);
      return parts.length ? parts.join(", ") : "none found";
    }
    case "generate_coaching_questions":
      return `${Array.isArray(r.questions) ? r.questions.length : 0} questions generated`;
    case "check_sentiment_history": {
      const n = r.consecutiveNegativeCount as number;
      const avg =
        typeof r.averageSentiment === "number"
          ? r.averageSentiment.toFixed(2)
          : "—";
      return n > 0
        ? `${n} consecutive negative · avg ${avg}`
        : `No streak · avg ${avg}`;
    }
    case "create_escalation_reminder":
      return r.created ? `Reminder due ${r.dueDate}` : "Not created";
    default:
      return "";
  }
}

interface Props {
  entries: AgentLogEntry[];
}

export function AgentProcessLog({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries.length]);

  if (entries.length === 0) return null;

  const resolvedIds = new Set(
    entries
      .filter((e) => e.type === "tool_result")
      .map((e) => (e as Extract<AgentLogEntry, { type: "tool_result" }>).toolCallId),
  );

  return (
    <div className="rounded-lg border bg-muted/10 overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20">
        <h2 className="text-sm font-semibold">Agent reasoning</h2>
      </div>
      <div className="overflow-y-auto max-h-[calc(100vh-12rem)] px-4 py-3 space-y-3">
        {entries.map((entry, i) => {
          if (entry.type === "thinking") {
            if (!entry.content.trim()) return null;
            return (
              <p
                key={i}
                className="text-xs text-muted-foreground italic leading-relaxed"
              >
                {entry.content}
              </p>
            );
          }

          if (entry.type === "tool_call") {
            const done = resolvedIds.has(entry.toolCallId);
            const label = TOOL_LABELS[entry.toolName] ?? entry.toolName;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <ArrowRight
                  className={`h-3 w-3 shrink-0 ${done ? "text-muted-foreground/30" : "text-muted-foreground"}`}
                />
                <span
                  className={
                    done
                      ? "text-muted-foreground/40 line-through"
                      : "text-foreground font-medium"
                  }
                >
                  {label}
                </span>
                {!done && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>
            );
          }

          if (entry.type === "tool_result") {
            const label = TOOL_LABELS[entry.toolName] ?? entry.toolName;
            const summary = toolResultSummary(entry.toolName, entry.result);
            const isEscalation = entry.toolName === "create_escalation_reminder";
            return (
              <div key={i} className="flex items-start gap-2 text-xs">
                {isEscalation ? (
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{label}</span>
                  {summary && (
                    <span className="text-muted-foreground"> — {summary}</span>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
