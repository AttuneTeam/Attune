"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatReviewAge, isStale } from "@/lib/map/attention";
import type { AreaNode } from "@/lib/map/grouping";
import type { MapArea } from "@/lib/map/types";
import { ConfidenceControl } from "./ConfidenceControl";
import { InlineAreaAdd } from "./InlineAreaAdd";

/**
 * One area on the map, plus its descendants.
 *
 * The row states facts, it does not raise alarms. Per FR6 the coral attention
 * mark lives once on the domain heading, never on every row that qualifies —
 * `tertiary` is a scalpel, and a screen where a third of the rows are coral
 * says nothing at all. Where a row does want noticing, it gets tonal weight
 * (full-strength foreground instead of muted) rather than colour.
 */

/** Matches the depth CHECK on the table: roots, children, grandchildren. */
const MAX_DEPTH = 2;

export function AreaRow({
  area,
  now,
}: {
  area: AreaNode<MapArea>;
  now?: Date;
}) {
  const stale = isStale(area, now);
  const [addingChild, setAddingChild] = useState(false);
  const canNest = area.depth < MAX_DEPTH;

  return (
    <div>
      <div
        className={cn(
          "flex items-baseline justify-between gap-4 rounded-md px-3 py-2 transition-colors",
          "hover:bg-accent/30",
        )}
      >
        <p className="min-w-0 flex-1 truncate text-sm">{area.title}</p>

        <div className="flex shrink-0 items-baseline gap-3">
          <ConfidenceControl
            areaId={area.id}
            areaTitle={area.title}
            confidence={area.confidence}
          />

          {/* Tonal emphasis, not colour: a stale row reads heavier without
              spending the coral that the domain count needs. */}
          <span
            className={cn(
              "w-24 text-right text-[11px] tabular-nums",
              stale ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {formatReviewAge(area, now)}
          </span>

          <span className="w-28 truncate text-right text-[11px] text-muted-foreground">
            {area.owner ? area.owner.name : "unowned"}
          </span>

          {/* Actions sit at low contrast until hovered or focused: the row is
              for reading first. They stay reachable by keyboard and are always
              rendered, since a hover-only control is unusable on touch. */}
          <div className="flex items-center">
            {canNest && (
              <button
                type="button"
                onClick={() => setAddingChild((open) => !open)}
                aria-expanded={addingChild}
                title="Add an area beneath this one"
                className={cn(
                  "flex size-11 items-center justify-center rounded-md",
                  "text-muted-foreground/50 transition-colors",
                  "hover:bg-accent/30 hover:text-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                )}
              >
                <Plus className="size-3.5" />
                <span className="sr-only">Add an area beneath {area.title}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {addingChild && (
        <div className="ml-6 mt-1">
          <InlineAreaAdd
            parentId={area.id}
            placeholder={`Add beneath ${area.title}`}
          />
        </div>
      )}

      {area.children.length > 0 && (
        // Indented by whitespace alone. No guide lines, no left border.
        <div className="mt-1 ml-6 space-y-1">
          {area.children.map((child) => (
            <AreaRow key={child.id} area={child} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
