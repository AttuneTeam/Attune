"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import {
  persistCollapsedDomains,
  type CollapsedDomains,
} from "@/lib/map/collapse";
import type { DomainGroup as DomainGroupData, DomainRef } from "@/lib/map/grouping";
import type { MapArea } from "@/lib/map/types";
import { cn } from "@/lib/utils";
import type { OwnerOption } from "./AreaOwnerPicker";
import { BrainDumpSheet } from "./BrainDumpSheet";
import { DomainDialog } from "./DomainDialog";
import { DomainGroup } from "./DomainGroup";
import { MapEmptyState } from "./MapEmptyState";

/**
 * The Surface Area Map.
 *
 * Owns which domains are collapsed, and naming a new one. Everything else is a
 * thin shell over the tested transforms in lib/map/.
 *
 * Domains are rows now (FR10), so a newly named one is created immediately
 * rather than held in view state until something is filed under it. The
 * pending-group device that stood in for this before has been retired.
 *
 * The collapsed set arrives from the server as an array (a Set does not
 * serialise across the boundary) so the first paint is already correct.
 */
export function SurfaceAreaMapClient({
  groups,
  domains,
  members,
  initialCollapsed = [],
}: {
  groups: DomainGroupData<MapArea>[];
  domains: DomainRef[];
  /** Assignable owners for the detail panel's picker. */
  members: OwnerOption[];
  initialCollapsed?: (string | null)[];
}) {
  const [collapsed, setCollapsed] = useState<CollapsedDomains>(
    () => new Set(initialCollapsed),
  );
  const [creatingDomain, setCreatingDomain] = useState(false);
  const [brainDumping, setBrainDumping] = useState(false);

  function toggle(domainId: string | null) {
    // Computed outside the updater: persisting inside it would fire twice
    // under StrictMode's double invocation.
    const next = new Set(collapsed);
    if (next.has(domainId)) next.delete(domainId);
    else next.add(domainId);
    setCollapsed(next);
    persistCollapsedDomains(next);
  }

  const totalAreas = groups.reduce((sum, g) => sum + g.summary.total, 0);
  const totalAttention = groups.reduce((sum, g) => sum + g.summary.attention, 0);
  const hasAnything = groups.length > 0;

  return (
    <div className="mx-auto max-w-4xl py-2 sm:py-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">Map</h1>
          {/* Suppressed when empty: "0 areas across 0 domains" is noise next to
              an empty state that already says everything worth saying. */}
          {hasAnything && (
            <p className="mt-2 text-sm text-muted-foreground">
              {totalAreas} {totalAreas === 1 ? "area" : "areas"} across{" "}
              {groups.length} {groups.length === 1 ? "domain" : "domains"}
              {totalAttention > 0 && (
                <>
                  {" · "}
                  {/* The one coral element on this screen. Its force comes
                      entirely from being the only one — the per-domain counts
                      are emphasised by weight instead. */}
                  <span className="font-medium text-tertiary">
                    {totalAttention} worth a look
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setBrainDumping(true)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 text-[11px] font-medium",
              "text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <Sparkles className="size-3.5" />
            Brain dump
          </button>

          {hasAnything && (
          <button
            type="button"
            onClick={() => setCreatingDomain(true)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 text-[11px] font-medium",
              "text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <Plus className="size-3.5" />
            New domain
          </button>
          )}
        </div>
      </header>

      <DomainDialog open={creatingDomain} onOpenChange={setCreatingDomain} />
      <BrainDumpSheet
        domains={domains}
        open={brainDumping}
        onOpenChange={setBrainDumping}
      />

      {!hasAnything ? (
        <MapEmptyState />
      ) : (
        // Domains are separated by whitespace alone — no rules, no dividers.
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <DomainGroup
              key={group.domainId ?? "ungrouped"}
              group={group}
              domains={domains}
              members={members}
              expanded={!collapsed.has(group.domainId)}
              onToggle={() => toggle(group.domainId)}
              isFirst={group.domainId === domains[0]?.id}
              isLast={group.domainId === domains[domains.length - 1]?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
