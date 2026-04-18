"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, TrendingUp, GitBranch } from "lucide-react";
import { toast } from "sonner";

type InsightType = "risk" | "pattern" | "opportunity";
type Priority = "high" | "medium" | "low";

interface Insight {
  headline: string;
  detail: string;
  type: InsightType;
  priority: Priority;
  members: string[];
}

interface PulseResult {
  insights: Insight[];
  generated_at: string | null;
}

const TYPE_ICON = {
  risk: AlertTriangle,
  pattern: GitBranch,
  opportunity: TrendingUp,
};

const TYPE_COLOR: Record<InsightType, string> = {
  risk: "text-destructive",
  pattern: "text-blue-500",
  opportunity: "text-[#6D998F]",
};

const PRIORITY_VARIANT: Record<
  Priority,
  "destructive" | "default" | "secondary"
> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onResultLoaded?: (result: any) => void;
}

export function TeamPulseCard({ onResultLoaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PulseResult | null>(null);

  useEffect(() => {
    fetch("/api/ai/team-pulse")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setResult({
            insights: data.insights,
            generated_at: data.generated_at,
          });
          onResultLoaded?.(data);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/team-pulse", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Generation failed");
        return;
      }
      const data = await res.json();
      setResult({ insights: data.insights, generated_at: data.generated_at });
      onResultLoaded?.(data);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!result) {
    return (
      <div className="rounded-lg border bg-card px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm">No team pulse generated yet</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={generate}
          disabled={loading}
          className="text-xs h-7"
        >
          {loading ? "Generating…" : "Generate pulse"}
        </Button>
      </div>
    );
  }

  const sorted = [...result.insights].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          {result.generated_at && (
            <p className="text-xs text-muted-foreground">
              Last run{" "}
              {new Date(result.generated_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={generate}
          disabled={loading}
          className="text-xs h-7 text-muted-foreground"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? "Refreshing…" : "Re-generate"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card divide-y divide-border">
        {sorted.map((insight, i) => {
          const Icon = TYPE_ICON[insight.type];
          return (
            <div key={i} className="px-4 py-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <Icon
                  className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${TYPE_COLOR[insight.type]}`}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium leading-snug">
                      {insight.headline}
                    </span>
                    <Badge
                      variant={PRIORITY_VARIANT[insight.priority]}
                      className="text-[10px] capitalize"
                    >
                      {insight.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight.detail}
                  </p>
                  {insight.members.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {insight.members.map((m) => (
                        <Badge
                          key={m}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
