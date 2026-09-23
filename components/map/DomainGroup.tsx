"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteDomain, moveDomain } from "@/lib/map/api";
import { DomainDialog } from "./DomainDialog";
import { cn } from "@/lib/utils";
import { COVERAGE_DOTS, filledCoverageDots } from "@/lib/map/coverage";
import type { DomainGroup as DomainGroupData, DomainRef } from "@/lib/map/grouping";
import type { MapArea } from "@/lib/map/types";
import { AreaRow } from "./AreaRow";
import type { OwnerOption } from "./AreaOwnerPicker";
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
  domains,
  members,
  isFirst,
  isLast,
}: {
  group: DomainGroupData<MapArea>;
  expanded: boolean;
  onToggle: () => void;
  now?: Date;
  /** Every domain on the map, so a row can offer to move an area elsewhere. */
  domains: readonly DomainRef[];
  members: readonly OwnerOption[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    if (busy) return;
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? "That could not be saved.");
      return;
    }
    setConfirmingRemoval(false);
    router.refresh();
  }
  // Keyed by id so a domain literally named "ungrouped" cannot collide with
  // the ungrouped bucket.
  const bodyId = `domain-${group.domainId ?? "none"}`;
  // Narrowed once into a local so TypeScript carries the non-null through the
  // callbacks below. Reading group.domainId inside them would need a
  // non-null assertion at every call site.
  const domainId = group.domainId;
  const { summary } = group;

  return (
    <section>
      <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          // 44x44 minimum touch target, met by the padding rather than by
          // stretching the icon.
          className={cn(
            // relative anchors the sr-only label inside — see ConfidenceControl.
            "relative -ml-2 flex size-11 shrink-0 items-center justify-center rounded-md",
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

        {domainId !== null && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title={`Actions for ${group.domain}`}
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-md",
                    "before:absolute before:-inset-2 before:content-['']",
                    "text-muted-foreground/50 transition-colors",
                    "hover:bg-accent/30 hover:text-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  )}
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Actions for {group.domain}</span>
                </button>
              }
            />
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Pencil className="size-3.5" />
                Rename
              </DropdownMenuItem>
              {/* Disabled at the ends rather than hidden: a control that
                  vanishes makes the manager wonder what they did wrong. */}
              <DropdownMenuItem
                disabled={isFirst}
                onClick={() => void run(() => moveDomain(domainId, "up"))}
              >
                <ArrowUp className="size-3.5" />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isLast}
                onClick={() => void run(() => moveDomain(domainId, "down"))}
              >
                <ArrowDown className="size-3.5" />
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmingRemoval(true)}
                className="text-destructive"
              >
                <Trash2 className="size-3.5" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <span className="ml-auto flex shrink-0 items-baseline gap-3 whitespace-nowrap text-[11px]">
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

      {domainId !== null && (
        <DomainDialog
          open={renaming}
          onOpenChange={setRenaming}
          domain={{ id: domainId, name: group.domain ?? "" }}
        />
      )}

      {/* Also gated on domainId: it can only be armed from the menu, which
          the ungrouped bucket never renders, but stating it lets TypeScript
          carry the narrowing instead of needing an assertion. */}
      {confirmingRemoval && domainId !== null && (
        <div
          className="mt-2 flex flex-wrap items-center gap-3 rounded-md bg-surface-dim px-3 py-2"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmingRemoval(false);
          }}
        >
          <p className="text-[11px] text-muted-foreground">
            {/* States what survives, not just what goes. Removing a heading
                must never read as though it removes the territory. */}
            {summary.total === 0
              ? `Remove "${group.domain}"?`
              : `Remove "${group.domain}"? The ${
                  summary.total === 1 ? "area" : `${summary.total} areas`
                } in it stay on the map, ungrouped.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={() => void run(() => deleteDomain(domainId))}
              className={cn(
                "min-h-11 rounded-md px-3 text-[11px] font-medium text-destructive",
                "hover:bg-accent/30 disabled:opacity-50",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              {busy ? "Removing" : "Remove"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemoval(false)}
              className={cn(
                "min-h-11 rounded-md px-3 text-[11px] text-muted-foreground",
                "hover:bg-accent/30 hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div
          id={bodyId}
          // Level-2 surface nested inside the page ground. In the charcoal dark
          // theme this reads as a soft inset; in light, where the surface
          // levels currently share a value (see product-guidelines.md, Known
          // Drift), the whitespace does the work instead.
          className="mt-2 space-y-0.5 rounded-lg bg-card p-2 sm:p-3"
        >
          {group.roots.map((area, i) => (
            <AreaRow
              key={area.id}
              area={area}
              now={now}
              domains={domains}
              members={members}
              isFirst={i === 0}
              isLast={i === group.roots.length - 1}
            />
          ))}

          {/* Capture lives at the foot of the group it adds to, so the domain
              is implied by where you are typing rather than chosen from a
              dropdown. */}
          <InlineAreaAdd
            domainId={group.domainId}
            domainName={group.domain}
            className="mt-1"
          />
        </div>
      )}
    </section>
  );
}
