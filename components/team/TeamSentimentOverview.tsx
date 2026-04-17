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
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

interface SentimentPoint {
  date: string;
  score: number;
  memberName: string;
}

interface Props {
  data: SentimentPoint[];
  memberNames: string[];
}

// Distinct palette for up to 8 members
const COLORS = [
  "#6D998F",
  "#F06539",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
  "#84cc16",
];

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

export function TeamSentimentOverview({ data, memberNames }: Props) {
  if (data.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Sentiment Trends
        </h2>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            No sentiment data yet. Run Summarize on interaction notes to start tracking.
          </p>
        </div>
      </div>
    );
  }

  // Build chart data: one row per date, one key per member
  const dateMap: Record<string, Record<string, number>> = {};
  data.forEach(({ date, score, memberName }) => {
    const label = format(parseISO(date), "MMM d");
    if (!dateMap[label]) dateMap[label] = {};
    dateMap[label][memberName] = score;
  });

  const chartData = Object.entries(dateMap)
    .sort((a, b) => {
      // Sort by original date
      const da = data.find((d) => format(parseISO(d.date), "MMM d") === a[0])?.date ?? "";
      const db = data.find((d) => format(parseISO(d.date), "MMM d") === b[0])?.date ?? "";
      return da.localeCompare(db);
    })
    .map(([label, scores]) => ({ date: label, ...scores }));

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Sentiment Trends
      </h2>
      <div className="rounded-lg border bg-card p-4">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
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
                  return (
                    <div className="text-xs bg-popover border rounded-md px-2.5 py-1.5 shadow-sm space-y-1">
                      <p className="text-muted-foreground mb-1">{label}</p>
                      {payload.map((p) => {
                        const val = p.value as number;
                        const keyStr = String(p.dataKey);
                        return (
                          <p
                            key={keyStr}
                            className="font-medium"
                            style={{ color: p.color }}
                          >
                            {keyStr}:{" "}
                            <span style={{ color: scoreColor(val) }}>
                              {val > 0 ? "+" : ""}
                              {val.toFixed(2)} — {scoreLabel(val)}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                iconSize={8}
              />
              {memberNames.map((name, idx) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={1.5}
                  dot={{ r: 2.5, strokeWidth: 0, fill: COLORS[idx % COLORS.length] }}
                  activeDot={{ r: 3.5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
