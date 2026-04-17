"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type Archetype = "Firefighter" | "Operator" | "Strategist" | "Coach" | "Explorer" | "Reflector";

interface MapScores {
  direction: number;
  delivery: number;
  people: number;
  ideas: number;
  judgement: number;
  self: number;
}

interface Snapshot {
  archetype: { label: Archetype; explanation: string };
  managerial_summary: string;
  map_scores: MapScores;
  problem_patterns: string[];
  behavioural_insights: string[];
  strengths: string[];
  growth_edge: string[];
  reflection_prompts: string[];
  period: string;
  generated_at: string | null;
}

// ── Archetype config ───────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<Archetype, { color: string; bg: string; border: string }> = {
  Firefighter: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  Operator: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  Strategist: { color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  Coach: { color: "text-[#6D998F]", bg: "bg-teal-50", border: "border-teal-200" },
  Explorer: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  Reflector: { color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 space-y-3 ${className ?? ""}`}>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm flex gap-2">
          <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ManagerialMap({ scores }: { scores: MapScores }) {
  const data = [
    { subject: "Direction", value: scores.direction },
    { subject: "Delivery", value: scores.delivery },
    { subject: "People", value: scores.people },
    { subject: "Ideas", value: scores.ideas },
    { subject: "Judgement", value: scores.judgement },
    { subject: "Self", value: scores.self },
  ];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
        <Radar
          dataKey="value"
          fill="hsl(var(--primary))"
          fillOpacity={0.25}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function ArchetypeCard({ archetype }: { archetype: Snapshot["archetype"] }) {
  const config = ARCHETYPE_CONFIG[archetype.label];
  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-5`}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Your Archetype
      </p>
      <p className={`text-2xl font-bold ${config.color} mb-2`}>{archetype.label}</p>
      <p className="text-sm text-muted-foreground">{archetype.explanation}</p>
    </div>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let label: string;
  if (diffMins < 2) label = "just now";
  else if (diffMins < 60) label = `${diffMins} minutes ago`;
  else if (diffHours < 24) label = `${diffHours} hours ago`;
  else if (diffDays === 1) label = "yesterday";
  else label = `${diffDays} days ago`;

  return <span className="text-xs text-muted-foreground">Last generated {label}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ManagerProfileInsights() {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [period, setPeriod] = useState<"monthly" | "quarterly">("quarterly");

  useEffect(() => {
    fetch("/api/ai/manager-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSnapshot(data);
          if (data.period) setPeriod(data.period);
        }
      })
      .catch(() => {});
  }, []);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/manager-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) {
        toast.error("Generation failed — try again");
        return;
      }
      const data = await res.json();
      setSnapshot(data);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (!snapshot && !loading) {
    return (
      <div className="pt-6 flex justify-center">
        <div className="rounded-xl border bg-card p-10 text-center max-w-md w-full space-y-5">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Generate your manager profile</h3>
            <p className="text-sm text-muted-foreground">
              A behavioural snapshot of how you operated this period — your archetype, attention
              patterns, strengths, and growth edge.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as "monthly" | "quarterly")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">This Month</SelectItem>
                <SelectItem value="quarterly">This Quarter</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generate} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="pt-6 flex justify-center">
        <div className="rounded-xl border bg-card p-10 text-center max-w-md w-full space-y-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">Analysing your patterns…</p>
            <p className="text-sm text-muted-foreground mt-1">This takes a few seconds.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Snapshot loaded ──────────────────────────────────────────────────────────

  if (!snapshot) return null;

  return (
    <div className="pt-4 space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as "monthly" | "quarterly")}
          >
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">This Month</SelectItem>
              <SelectItem value="quarterly">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          {snapshot.generated_at && <RelativeTime iso={snapshot.generated_at} />}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={generate}
          disabled={loading}
          className="gap-1.5 h-8 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </Button>
      </div>

      {/* Archetype */}
      <ArchetypeCard archetype={snapshot.archetype} />

      {/* Map + Summary + Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Managerial Map">
          <ManagerialMap scores={snapshot.map_scores} />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Summary">
            <p className="text-sm leading-relaxed">{snapshot.managerial_summary}</p>
          </SectionCard>

          <SectionCard title="Work & Problem Patterns">
            <BulletList items={snapshot.problem_patterns} />
          </SectionCard>
        </div>
      </div>

      {/* Insights row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Behavioural Insights">
          <BulletList items={snapshot.behavioural_insights} />
        </SectionCard>

        <SectionCard title="Strengths Demonstrated">
          <BulletList items={snapshot.strengths} />
        </SectionCard>

        <SectionCard title="Growth Edge" className="border-amber-200">
          <BulletList items={snapshot.growth_edge} />
        </SectionCard>
      </div>

      {/* Reflection prompts */}
      <SectionCard title="Reflection Prompts">
        <div className="space-y-2">
          {snapshot.reflection_prompts.map((prompt, i) => (
            <div key={i} className="flex gap-2.5 text-sm">
              <Badge
                variant="outline"
                className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shrink-0 mt-0.5"
              >
                {i + 1}
              </Badge>
              <span className="text-muted-foreground">{prompt}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
