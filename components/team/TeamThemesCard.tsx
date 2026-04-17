"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TeamTheme {
  theme: string;
  count: number;
  members: string[];
}

interface Props {
  themes: TeamTheme[];
}

export function TeamThemesCard({ themes }: Props) {
  const [selected, setSelected] = useState<TeamTheme | null>(null);

  if (themes.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Recurring Themes
        </h2>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            No themes yet. Summarise interaction notes to start tracking recurring topics.
          </p>
        </div>
      </div>
    );
  }

  const maxCount = themes[0]?.count ?? 1;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Recurring Themes
      </h2>
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {themes.map((t) => {
            const isSelected = selected?.theme === t.theme;
            const intensity = Math.round((t.count / maxCount) * 5);
            return (
              <button
                key={t.theme}
                type="button"
                onClick={() => setSelected(isSelected ? null : t)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                }`}
              >
                {t.theme}
                <span
                  className={`text-[10px] font-semibold ${
                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="rounded-md bg-muted/50 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">
                &ldquo;{selected.theme}&rdquo; — {selected.count}{" "}
                {selected.count === 1 ? "person" : "people"}
              </p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selected.members.map((name) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
