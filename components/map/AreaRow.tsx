"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatReviewAge, isStale } from "@/lib/map/attention";
import { countDescendants, type AreaNode } from "@/lib/map/grouping";
import type { MapArea } from "@/lib/map/types";
import { deleteArea, moveArea, updateArea } from "@/lib/map/api";
import { AreaRowMenu } from "./AreaRowMenu";
import { ConfidenceControl } from "./ConfidenceControl";
import { InlineAreaAdd } from "./InlineAreaAdd";

/**
 * One area on the map, plus its descendants.
 *
 * The row states facts, it does not raise alarms. Per FR6 the coral attention
 * mark lives once on the page header, never on the rows: tertiary is a scalpel,
 * and a screen where a third of the rows are coral says nothing at all. Where a
 * row wants noticing it gets tonal weight (full-strength foreground instead of
 * muted) rather than colour.
 *
 * Nesting is expressed as padding on the title, not as a wrapping indented
 * container. Wrapping narrowed every descendant row, pushing the metadata
 * columns progressively leftward so an intentional hierarchy read as a ragged
 * one. Indenting only the title keeps confidence, review age and owner in true
 * columns down the whole group.
 */

/** Matches the depth CHECK on the table: roots, children, grandchildren. */
const MAX_DEPTH = 2;

/** One indent step, in pixels. Applied to the title alone. */
const INDENT = 24;

export function AreaRow({
  area,
  now,
  domains,
  isFirst,
  isLast,
}: {
  area: AreaNode<MapArea>;
  now?: Date;
  /** Every domain on the map, so this area can be sent to one. */
  domains: (string | null)[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const stale = isStale(area, now);
  const [addingChild, setAddingChild] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(area.title);
  const [namingDomain, setNamingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [busy, setBusy] = useState(false);
  // Escape has to beat the blur that follows it, or cancelling would commit.
  const cancelledRef = useRef(false);

  const canNest = area.depth < MAX_DEPTH;
  const descendants = countDescendants(area);
  const router = useRouter();
  const indent = { paddingLeft: area.depth * INDENT };

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    if (busy) return;
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? "That could not be saved.");
      return false;
    }
    router.refresh();
    return true;
  }

  function startRename() {
    setDraft(area.title);
    cancelledRef.current = false;
    setRenaming(true);
  }

  async function commitRename() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setRenaming(false);
      setDraft(area.title);
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed || trimmed === area.title) {
      setRenaming(false);
      setDraft(area.title);
      return;
    }
    setRenaming(false);
    const ok = await run(() => updateArea(area.id, { title: trimmed }));
    // Reopen with the text intact rather than discarding what was typed.
    if (!ok) setRenaming(true);
  }

  async function commitNewDomain() {
    const trimmed = newDomain.trim();
    if (!trimmed) {
      setNamingDomain(false);
      return;
    }
    setNamingDomain(false);
    setNewDomain("");
    await run(() => updateArea(area.id, { domain: trimmed }));
  }

  async function remove() {
    if (removing) return;
    setRemoving(true);
    const result = await deleteArea(area.id);
    setRemoving(false);
    if (!result.ok) {
      toast.error(result.message);
      setConfirmingRemoval(false);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {/* The row is exactly as tall as its 44x44 actions: aligning centrally
          rather than on the baseline keeps the vertical rhythm tight, and the
          touch targets come for free from the row height. */}
      {/* Wraps below sm: the title takes a full line and the metadata follows
          underneath. Kept on one line at desktop widths, where the fixed
          columns are what make confidence, review age and owner scannable
          down the group. */}
      <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-3 py-1 transition-colors hover:bg-accent/30 sm:flex-nowrap sm:py-0">
        {renaming ? (
          <input
            autoFocus
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitRename();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelledRef.current = true;
                setRenaming(false);
                setDraft(area.title);
              }
            }}
            aria-label={`Rename ${area.title}`}
            className={cn(
              "min-w-0 flex-1 basis-full rounded-md bg-transparent text-sm sm:basis-auto",
              "focus:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "disabled:opacity-50",
            )}
            style={indent}
          />
        ) : (
          /* Double-click, not click: a single click has to stay free for the
             detail panel, and a title that jumps into an editor whenever it is
             touched feels twitchy. The menu's Rename is the discoverable and
             keyboard-reachable path, so nothing depends on the double-click. */
          <p
            onDoubleClick={startRename}
            title="Double-click to rename"
            className="min-w-0 flex-1 basis-full truncate text-sm sm:basis-auto"
            style={indent}
          >
            {area.title}
          </p>
        )}

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <ConfidenceControl
            areaId={area.id}
            areaTitle={area.title}
            confidence={area.confidence}
          />

          {/* Tonal emphasis, not colour: a stale row reads heavier without
              spending the coral the header needs. */}
          <span
            className={cn(
              "shrink-0 text-right text-[11px] tabular-nums sm:w-24",
              stale ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {formatReviewAge(area, now)}
          </span>

          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground sm:w-28 sm:flex-none">
            {area.owner ? area.owner.name : "unowned"}
          </span>

          <AreaRowMenu
            areaTitle={area.title}
            domains={domains}
            currentDomain={area.domain}
            canNest={canNest}
            canMoveUp={!isFirst}
            canMoveDown={!isLast}
            onRename={startRename}
            onAddChild={() => setAddingChild(true)}
            onRemove={() => setConfirmingRemoval(true)}
            onMove={(direction) => void run(() => moveArea(area.id, direction))}
            onMoveToDomain={(domain) => void run(() => updateArea(area.id, { domain }))}
            onNewDomain={() => setNamingDomain(true)}
          />
        </div>
      </div>

      {namingDomain && (
        <div className="flex items-center gap-2 px-3" style={indent}>
          <input
            autoFocus
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onBlur={() => void commitNewDomain()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitNewDomain();
              }
              if (e.key === "Escape") {
                setNamingDomain(false);
                setNewDomain("");
              }
            }}
            placeholder="New domain name"
            aria-label={`Move ${area.title} to a new domain`}
            className={cn(
              "min-h-11 flex-1 rounded-md bg-transparent text-sm",
              "placeholder:text-muted-foreground/70",
              "focus:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          />
        </div>
      )}

      {confirmingRemoval && (
        // Inline rather than a modal, and deliberately not window.confirm: a
        // native dialog blocks the page and reads as a browser error, and a
        // modal for a one-line decision is heavier than the decision.
        <div
          className="flex flex-wrap items-center gap-3 rounded-md bg-surface-dim px-3 py-2"
          style={indent}
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmingRemoval(false);
          }}
        >
          <p className="text-[11px] text-muted-foreground">
            {descendants === 0
              ? `Remove "${area.title}"?`
              : `Remove "${area.title}"? The ${
                  descendants === 1 ? "area" : `${descendants} areas`
                } beneath it ${descendants === 1 ? "goes" : "go"} too.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              autoFocus
              disabled={removing}
              onClick={() => void remove()}
              className={cn(
                "min-h-11 rounded-md px-3 text-[11px] font-medium text-destructive",
                "hover:bg-accent/30 disabled:opacity-50",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              {removing ? "Removing" : "Remove"}
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

      {addingChild && (
        <div style={{ paddingLeft: (area.depth + 1) * INDENT }}>
          <InlineAreaAdd parentId={area.id} placeholder={`Add beneath ${area.title}`} />
        </div>
      )}

      {/* Descendants are siblings in the DOM, not nested children, so every row
          in the group shares one set of metadata columns. */}
      {area.children.map((child, i) => (
        <AreaRow
          key={child.id}
          area={child}
          now={now}
          domains={domains}
          isFirst={i === 0}
          isLast={i === area.children.length - 1}
        />
      ))}
    </>
  );
}
