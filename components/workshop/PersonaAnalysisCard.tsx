"use client";

import { getPersona } from "@/lib/ai/personas";
import type { WorkshopPersonaAnalysis } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const priorityColors: Record<string, string> = {
  high: "text-destructive border-destructive/40",
  medium: "text-foreground border-border",
  low: "text-muted-foreground border-border",
};

export function PersonaAnalysisCard({
  analysis,
}: {
  analysis: WorkshopPersonaAnalysis;
}) {
  const persona = getPersona(analysis.persona_id as Parameters<typeof getPersona>[0]);

  return (
    <details className="group rounded-xl border border-border bg-card overflow-hidden">
      <summary className="flex flex-col gap-1 p-4 cursor-pointer list-none select-none hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs w-fit">
            {persona.name}
          </Badge>
          <span className="text-xs text-muted-foreground group-open:hidden">
            tap to expand
          </span>
        </div>
        <p className="text-sm italic text-muted-foreground leading-relaxed mt-1">
          {analysis.framing}
        </p>
      </summary>

      <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
        {analysis.reasoning && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Analysis
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {analysis.reasoning}
            </p>
          </div>
        )}

        {analysis.key_insights.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Key Insights
            </p>
            <ul className="space-y-1">
              {analysis.key_insights.map((insight, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.recommended_actions.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Recommended Actions
            </p>
            <ul className="space-y-2">
              {analysis.recommended_actions.map((item, i) => (
                <li key={i} className="text-sm flex gap-3 items-start">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] shrink-0 mt-0.5", priorityColors[item.priority])}
                  >
                    {item.priority}
                  </Badge>
                  <span className="flex-1">
                    {item.action}
                    <span className="text-muted-foreground ml-1">· {item.timeframe}</span>
                    {item.why && (
                      <span className="block text-xs text-muted-foreground mt-0.5">{item.why}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
            Blind Spots
          </p>
          <p className="text-sm text-muted-foreground">{analysis.blind_spots}</p>
        </div>

        {analysis.questions_to_explore.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Questions to Explore
            </p>
            <ol className="space-y-1 list-decimal list-inside">
              {analysis.questions_to_explore.map((q, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {q}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </details>
  );
}
