"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

type Severity = "critical" | "moderate" | "low";

interface CoverageResult {
  strengths: { area: string; detail: string }[];
  gaps: { area: string; severity: Severity; suggestion: string }[];
  spofs: { member: string; area: string; risk: string }[];
  overlaps: { area: string; members: string[]; note: string }[];
}

const SEVERITY_VARIANT = {
  critical: "destructive" as const,
  moderate: "default" as const,
  low: "secondary" as const,
};

export function TeamCoverageCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/team-coverage")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          const { generated_at, ...rest } = data;
          setResult(rest as CoverageResult);
          setGeneratedAt(generated_at ?? null);
        }
      })
      .catch(() => {});
  }, []);

  async function analyse() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/team-coverage", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Analysis failed");
        return;
      }
      const data = await res.json();
      const { generated_at, ...rest } = data;
      setResult(rest as CoverageResult);
      setGeneratedAt(generated_at ?? null);
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
          <h2 className="text-lg text-foreground font-bold flex gap-2">
            Team Insights
          </h2>
          <span className="text-sm">No coverage analysis yet</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={analyse}
          disabled={loading}
          className="text-xs h-7"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? "Analysing…" : "Analyse team"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="gap-2 text-muted-foreground">
          <h2 className="text-lg text-foreground font-bold flex gap-2">
            Team Insights
          </h2>
          {generatedAt && (
            <p className="text-xs">
              Last run{" "}
              {new Date(generatedAt).toLocaleDateString(undefined, {
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
          onClick={analyse}
          disabled={loading}
          className="text-xs h-7 text-muted-foreground"
        >
          <Sparkles className="h-4 w-4" />

          {loading ? "Refreshing…" : "Re-analyse"}
        </Button>
      </div>

      <Tabs defaultValue="gaps">
        <TabsList className="p-0.5">
          <TabsTrigger value="gaps" className="rounded-md text-xs">
            Gaps
            {result.gaps.length > 0 && (
              <span className="ml-1.5 rounded-full bg-secondary text-foreground px-1.5 text-[10px] font-medium">
                {result.gaps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="spofs" className="rounded-md text-xs">
            SPOFs
            {result.spofs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-secondary text-foreground px-1.5 text-[10px] font-medium">
                {result.spofs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="strengths" className="rounded-md text-xs">
            Strengths
          </TabsTrigger>
          <TabsTrigger value="overlaps" className="rounded-md text-xs">
            Overlaps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gaps">
          <div className="rounded-lg border bg-card p-4 mt-2">
            {result.gaps.length === 0 ? (
              <p className="text-xs text-muted-foreground">None identified</p>
            ) : (
              <ul className="space-y-3">
                {result.gaps.map((g, i) => (
                  <li key={i} className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{g.area}</span>
                      <Badge
                        variant={SEVERITY_VARIANT[g.severity]}
                        className="text-xs capitalize"
                      >
                        {g.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {g.suggestion}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="spofs">
          <div className="rounded-lg border bg-card p-4 mt-2">
            {result.spofs.length === 0 ? (
              <p className="text-xs text-muted-foreground">None identified</p>
            ) : (
              <ul className="space-y-3">
                {result.spofs.map((s, i) => (
                  <li key={i} className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{s.area}</span>
                      <Badge variant="outline" className="text-xs">
                        {s.member}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.risk}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="strengths">
          <div className="rounded-lg border bg-card p-4 mt-2">
            {result.strengths.length === 0 ? (
              <p className="text-xs text-muted-foreground">None identified</p>
            ) : (
              <ul className="space-y-3">
                {result.strengths.map((s, i) => (
                  <li key={i} className="space-y-1">
                    <p className="text-sm font-medium">{s.area}</p>
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overlaps">
          <div className="rounded-lg border bg-card p-4 mt-2">
            {result.overlaps.length === 0 ? (
              <p className="text-xs text-muted-foreground">None identified</p>
            ) : (
              <ul className="space-y-3">
                {result.overlaps.map((o, i) => (
                  <li key={i} className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{o.area}</span>
                      {o.members.map((m) => (
                        <Badge key={m} variant="outline" className="text-xs">
                          {m}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{o.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
