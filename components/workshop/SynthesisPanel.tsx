"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { WorkshopSynthesis } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const priorityColors: Record<string, string> = {
  high: "text-destructive border-destructive/40",
  medium: "text-foreground border-border",
  low: "text-muted-foreground border-border",
};

export function SynthesisPanel({
  synthesis,
  userId,
}: {
  synthesis: WorkshopSynthesis;
  userId: string;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggleAction(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function saveAsTasks() {
    if (selected.size === 0) return;
    setSaving(true);
    const supabase = createClient();
    const rows = Array.from(selected).map((i) => ({
      user_id: userId,
      description: synthesis.unified_actions[i].action,
      status: "open" as const,
    }));
    const { error } = await supabase.from("action_items").insert(rows);
    setSaving(false);
    if (error) {
      toast.error("Failed to save tasks");
    } else {
      toast.success(`Saved ${rows.length} task${rows.length > 1 ? "s" : ""}`);
      setSelected(new Set());
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Synthesis
        </p>
        <p className="text-sm leading-relaxed">{synthesis.summary}</p>
      </div>

      {synthesis.convergence_points.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Where perspectives agree
          </p>
          <ul className="space-y-1">
            {synthesis.convergence_points.map((point, i) => (
              <li key={i} className="text-sm flex gap-2 text-emerald-600 dark:text-emerald-400">
                <span className="shrink-0">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {synthesis.divergence_points.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Genuine tensions
          </p>
          <div className="space-y-2">
            {synthesis.divergence_points.map((d, i) => (
              <details key={i} className="rounded-lg border border-border">
                <summary className="text-sm font-medium px-3 py-2 cursor-pointer list-none hover:bg-muted/50 transition-colors">
                  {d.topic}
                </summary>
                <p className="px-3 pb-3 text-sm text-muted-foreground">{d.perspectives}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recommended Actions
          </p>
          {selected.size > 0 && (
            <Button
              size="sm"
              onClick={saveAsTasks}
              disabled={saving}
            >
              {saving ? "Saving…" : `Save ${selected.size} as task${selected.size > 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {synthesis.unified_actions.map((action, i) => (
            <label
              key={i}
              className={cn(
                "flex gap-3 items-start rounded-lg border px-3 py-3 cursor-pointer transition-colors",
                selected.has(i)
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() => toggleAction(i)}
                className="mt-0.5 shrink-0 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{action.action}</span>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] shrink-0", priorityColors[action.priority])}
                  >
                    {action.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{action.rationale}</p>
                {action.source_personas.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {action.source_personas.join(" · ")}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
