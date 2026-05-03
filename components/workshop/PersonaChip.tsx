"use client";

import type { Persona } from "@/lib/ai/personas";
import { cn } from "@/lib/utils";

export function PersonaChip({
  persona,
  selected,
  onToggle,
  disabled,
}: {
  persona: Persona;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {persona.name}
    </button>
  );
}
