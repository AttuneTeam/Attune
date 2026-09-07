"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { COVERAGE_DOTS, filledCoverageDots } from "@/lib/map/coverage";
import type { DomainGroup as DomainGroupData } from "@/lib/map/grouping";
import type { MapArea } from "@/lib/map/types";
import { AreaRow } from "./AreaRow";
import { CoverageDots } from "./CoverageDots";
import { InlineAreaAdd } from "./InlineAreaAdd";

/**
 * One territory on the map.
 *
 * Boundaries come from a surface shift and generous whitespace, never a rule or
 * a divider. The heading is a small, well-tracked label against the page's
 * large title — the big/small contrast is what reads as considered rather than
 * a wall of medium text.
 *
 * The attention count lives on the heading, never on every row that qualifies
 * (FR6) — one number per domain rather than a screenful of marks. It is
 * emphasised by weight rather than colour, so the page's single coral figure
 * keeps its force.
 */
export function DomainGroup({
  group,
  expanded,
  onToggle,
  now,
}: {
  group: DomainGroupData<MapArea>;
  expanded: boolean;
  onToggle: () => void;
  now?: Date;
}) {
  const key = group.domain ?? "ungrouped";
  const bodyId = `domain-${key}`;
  const { summary } = group;

  return (
    <section>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          // 44x44 minimum touch target, met by the padding rather than by
          // stretching the icon.
          className={cn(
            "-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          <ChevronRight
            className={cn("size-4 transition-transform", expanded && "rotate-90")}
          />
          <span className="sr-only">
            {expanded ? "Collapse" : "Expand"} {group.domain ?? "ungrouped areas"}
          </span>
        </button>

        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {group.domain ?? "Ungrouped"}
        </h2>

        <CoverageDots score={summary.score} className="ml-1" />
        <span className="sr-only">
          Coverage {filledCoverageDots(summary.score)} of {COVERAGE_DOTS}
        </span>

        <span className="ml-auto flex items-baseline gap-3 text-[11px]">
          <span className="text-muted-foreground">
            {summary.total} {summary.total === 1 ? "area" : "areas"}
          </span>
          {summary.attention > 0 && (
            // Emphasised tonally, not in coral. FR6 requires the count to live
            // on the group rather than on every row, but coral is a scalpel:
            // one per domain would put four on a typical screen. The single
            // coral figure lives in the page header instead.
            <span className="font-medium text-foreground">
              {summary.attention} worth a look
            </span>
          )}
        </span>
      </div>

      {expanded && (
        <div
          id={bodyId}
          // Level-2 surface nested inside the page ground. In the olive dark
          // theme this reads as a soft inset; in light, where the surface
          // levels currently share a value (see product-guidelines.md, Known
          // Drift), the whitespace does the work instead.
          className="mt-3 space-y-1 rounded-lg bg-card p-6"
        >
          {group.roots.map((area) => (
            <AreaRow key={area.id} area={area} now={now} />
          ))}

          {/* Capture lives at the foot of the group it adds to, so the domain
              is implied by where you are typing rather than chosen from a
              dropdown. */}
          <InlineAreaAdd domain={group.domain} className="mt-1" />
        </div>
      )}
    </section>
  );
}
