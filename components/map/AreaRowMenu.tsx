"use client";

import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Everything you can do to an area, behind one control.
 *
 * The row already carries a confidence chip, a review age and an owner. Adding
 * a separate icon for rename, move, reorder, nest and remove would have put six
 * controls on every line of a screen whose whole job is to stay calm, so they
 * live behind one "more" affordance instead (progressive disclosure, UX
 * principle 4). The confidence chip stays outside it: that is a value being
 * displayed, not an action.
 */
export function AreaRowMenu({
  areaTitle,
  domains,
  currentDomain,
  canNest,
  canMoveUp,
  canMoveDown,
  onRename,
  onAddChild,
  onRemove,
  onMove,
  onMoveToDomain,
  onNewDomain,
}: {
  areaTitle: string;
  /** Every domain currently on the map, so an area can be sent to one. */
  domains: (string | null)[];
  currentDomain: string | null;
  canNest: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: () => void;
  onAddChild: () => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  onMoveToDomain: (domain: string | null) => void;
  onNewDomain: () => void;
}) {
  const elsewhere = domains.filter((d) => d !== currentDomain);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title={`Actions for ${areaTitle}`}
            className={cn(
              // Small enough not to dominate the row, but the pointer target
              // stays 44x44 through an invisible inset pseudo-element -- the
              // guideline is about what you can hit, not what you can see.
              "relative flex size-7 items-center justify-center rounded-md",
              "before:absolute before:-inset-2 before:content-['']",
              "text-muted-foreground/50 transition-colors",
              "hover:bg-accent/30 hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions for {areaTitle}</span>
          </button>
        }
      />
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="size-3.5" />
          Rename
        </DropdownMenuItem>

        {/* Disabled at the ends of a group rather than hidden: a control that
            vanishes makes the manager wonder what they did wrong. */}
        <DropdownMenuItem disabled={!canMoveUp} onClick={() => onMove("up")}>
          <ArrowUp className="size-3.5" />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canMoveDown} onClick={() => onMove("down")}>
          <ArrowDown className="size-3.5" />
          Move down
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {elsewhere.map((domain) => (
              <DropdownMenuItem
                key={domain ?? " ungrouped"}
                onClick={() => onMoveToDomain(domain)}
              >
                {domain ?? "Ungrouped"}
              </DropdownMenuItem>
            ))}
            {elsewhere.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={onNewDomain}>New domain</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {canNest && (
          <DropdownMenuItem onClick={onAddChild}>
            <Plus className="size-3.5" />
            Add area beneath
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onRemove} className="text-destructive">
          <Trash2 className="size-3.5" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
