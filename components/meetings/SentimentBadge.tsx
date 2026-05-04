interface Props {
  score: number | null;
  className?: string;
}

function scoreColor(score: number) {
  if (score >= 0.3) return "#6D998F";
  if (score >= -0.3) return "#F06539";
  return "#b43a10";
}

function sentimentMeta(score: number | null) {
  if (score === null) return null;
  if (score >= 0.3)
    return { label: "Positive", variant: scoreColor(score) } as const;
  if (score >= -0.3)
    return { label: "Neutral", variant: scoreColor(score) } as const;
  return { label: "Negative", variant: scoreColor(score) } as const;
}

export function SentimentBadge({ score, className }: Props) {
  const meta = sentimentMeta(score);
  if (!meta) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded-full border"
      style={{ borderColor: meta.variant, color: meta.variant }}
    >
      {meta.label}
    </span>
  );
}
