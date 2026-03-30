'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

interface Props {
  data: number[]
}

function sentimentColor(value: number) {
  if (value >= 0.3) return '#22c55e'   // green
  if (value >= -0.3) return '#f59e0b'  // amber
  return '#ef4444'                      // red
}

export function SentimentSparkline({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-10 flex items-center">
        <span className="text-xs text-muted-foreground">No data yet</span>
      </div>
    )
  }

  const chartData = data.map((v, i) => ({ i, v }))
  const latest = data[data.length - 1]
  const color = sentimentColor(latest)

  return (
    <div className="h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const val = payload[0].value as number
              return (
                <div className="text-xs bg-popover border rounded px-2 py-1 shadow">
                  {val > 0 ? '+' : ''}{val.toFixed(2)}
                </div>
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
