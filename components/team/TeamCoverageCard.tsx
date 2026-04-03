"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronDown } from "lucide-react";
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
  const [open, setOpen] = useState(true);

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
      setResult(data);
      setOpen(true);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => result && setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Coverage Analysis</h2>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {!result && (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            analyse();
          }}
          disabled={loading}
          className="text-xs h-7"
        >
          {loading ? "Analysing…" : "Analyse team"}
        </Button>
      )}
      {result && open && (
        <div className="divide-y">
          {/* Gaps */}
          {result.gaps.length > 0 && (
            <section className="px-5 py-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Gaps
              </p>
              <ul className="space-y-2.5">
                {result.gaps.map((g, i) => (
                  <li key={i} className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
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
            </section>
          )}

          {/* Single points of failure */}
          {result.spofs.length > 0 && (
            <section className="px-5 py-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Single Points of Failure
              </p>
              <ul className="space-y-2.5">
                {result.spofs.map((s, i) => (
                  <li key={i} className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{s.area}</span>
                      <Badge variant="outline" className="text-xs">
                        {s.member}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.risk}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Strengths */}
          {result.strengths.length > 0 && (
            <section className="px-5 py-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Strengths
              </p>
              <ul className="space-y-2.5">
                {result.strengths.map((s, i) => (
                  <li key={i} className="space-y-0.5">
                    <span className="text-sm font-medium">{s.area}</span>
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Overlaps */}
          {result.overlaps.length > 0 && (
            <section className="px-5 py-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Overlaps
              </p>
              <ul className="space-y-2.5">
                {result.overlaps.map((o, i) => (
                  <li key={i} className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
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
            </section>
          )}

          <div className="px-5 py-3 rounded-b-lg">
            <Button
              size="sm"
              variant="ghost"
              onClick={analyse}
              disabled={loading}
              className="text-xs h-7 text-muted-foreground"
            >
              {loading ? "Refreshing…" : "Re-analyse"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
