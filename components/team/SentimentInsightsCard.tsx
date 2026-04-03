"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Props {
  avgSentiment: number | null;
  sentimentHistory: { date: string; score: number }[];
  themes: string[];
  nudges: string[];
  meetingCount: number;
}

function scoreColor(score: number) {
  if (score >= 0.3) return "#6D998F";
  if (score >= -0.3) return "#F06539";
  return "#b43a10";
}

function scoreLabel(score: number) {
  if (score >= 0.3) return "Positive";
  if (score >= -0.3) return "Neutral";
  return "Concerning";
}

export function SentimentInsightsCard({
  avgSentiment,
  sentimentHistory,
  themes,
  nudges,
  meetingCount,
}: Props) {
  const color = avgSentiment !== null ? scoreColor(avgSentiment) : "#94a3b8";

  const chartData = sentimentHistory.map((d) => ({
    date: format(parseISO(d.date), "MMM d"),
    score: d.score,
  }));

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        <h2 className="text-sm font-semibold">AI Insights</h2>
      </div>

      {meetingCount === 0 ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Run <span className="font-medium">Summarize</span> on interaction
          notes to start building sentiment data.
        </p>
      ) : (
        <>
          {/* Average sentiment score */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Avg sentiment</span>
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color }}
              >
                {avgSentiment !== null
                  ? (avgSentiment > 0 ? "+" : "") + avgSentiment.toFixed(2)
                  : "—"}
              </span>
              {avgSentiment !== null && (
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded-full border"
                  style={{ borderColor: color, color }}
                >
                  {scoreLabel(avgSentiment)}
                </span>
              )}
            </div>
          </div>

          {/* Trend chart */}
          {sentimentHistory.length >= 2 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Sentiment trend ({sentimentHistory.length} interactions)
              </p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      className="stroke-border opacity-50"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "currentColor" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      className="text-muted-foreground"
                    />
                    <YAxis
                      domain={[-1, 1]}
                      tick={{ fontSize: 9, fill: "currentColor" }}
                      tickLine={false}
                      axisLine={false}
                      tickCount={5}
                      tickFormatter={(v) => v.toFixed(1)}
                      className="text-muted-foreground"
                    />
                    <ReferenceLine
                      y={0}
                      stroke="currentColor"
                      strokeDasharray="4 4"
                      className="stroke-muted-foreground opacity-40"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const val = payload[0].value as number;
                        return (
                          <div className="text-xs bg-popover border rounded-md px-2.5 py-1.5 shadow-sm">
                            <p className="text-muted-foreground mb-0.5">
                              {label}
                            </p>
                            <p
                              className="font-semibold"
                              style={{ color: scoreColor(val) }}
                            >
                              {val > 0 ? "+" : ""}
                              {val.toFixed(2)} — {scoreLabel(val)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: color, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recurring themes */}
          {themes.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Recurring themes
              </p>
              <div className="flex flex-wrap gap-1">
                {themes.map((theme) => (
                  <Badge key={theme} variant="secondary" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Coaching nudges — shown even with no sentiment data if day-since nudge applies */}
      {nudges.length > 0 && (
        <div className={`space-y-2 ${meetingCount > 0 ? "border-t pt-4" : ""}`}>
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-xs font-medium">Coaching nudges</p>
          </div>
          <ul className="space-y-2">
            {nudges.map((nudge, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs text-muted-foreground leading-relaxed"
              >
                <span className="shrink-0 text-muted-foreground/40 mt-0.5">
                  ·
                </span>
                {nudge}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
