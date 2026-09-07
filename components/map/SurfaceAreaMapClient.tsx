"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { summariseCoverage } from "@/lib/map/coverage";
import { compareDomains } from "@/lib/map/grouping";
import {
  persistCollapsedDomains,
  type CollapsedDomains,
} from "@/lib/map/collapse";
import type { DomainGroup as DomainGroupData } from "@/lib/map/grouping";
import type { MapArea } from "@/lib/map/types";
import { DomainGroup } from "./DomainGroup";
import { MapEmptyState } from "./MapEmptyState";

/**
 * The Surface Area Map.
 *
 * Owns which domains are collapsed. Nothing else on this screen holds state
 * yet — capture, confidence and ownership arrive in Phase 3 — so the component
 * stays a thin shell over the tested transforms in lib/map/.
 *
 * The collapsed set arrives from the server as an array (a Set does not
 * serialise across the boundary) so the first paint is already correct.
 */
export function SurfaceAreaMapClient({
  groups,
  initialCollapsed = [],
}: {
  groups: DomainGroupData<MapArea>[];
  initialCollapsed?: (string | null)[];
}) {
  const [collapsed, setCollapsed] = useState<CollapsedDomains>(
    () => new Set(initialCollapsed),
  );

  const toggle = (domain: string | null) => {
    // Computed outside the updater: persisting inside it would fire twice
    // under StrictMode's double invocation.
    const next = new Set(collapsed);
    if (next.has(domain)) next.delete(domain);
    else next.add(domain);
    setCollapsed(next);
    persistCollapsedDomains(next);
  };

  // Domains a manager has named but not yet filled. They are not rows: a
  // domain is a text column on an area, so one only exists while something
  // sits in it. Holding them here lets the group appear the moment it is
  // named, and nothing is written until the first area lands — so abandoning
  // the idea leaves no empty record behind.
  const [pendingDomains, setPendingDomains] = useState<string[]>([]);
  const [namingDomain, setNamingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  const realDomains = new Set(groups.map((group) => group.domain));
  // Drop a pending group as soon as the real one exists, or it would render twice.
  const stillPending = pendingDomains.filter((domain) => !realDomains.has(domain));

  const rendered = [
    ...groups,
    ...stillPending.map((domain) => ({
      domain,
      roots: [],
      summary: summariseCoverage([]),
    })),
  ].sort((a, b) => compareDomains(a.domain, b.domain));

  const domains = rendered.map((group) => group.domain);

  function addDomain() {
    const trimmed = newDomain.trim();
    setNamingDomain(false);
    setNewDomain("");
    if (!trimmed || realDomains.has(trimmed) || pendingDomains.includes(trimmed)) return;
    setPendingDomains((current) => [...current, trimmed]);
  }

  const totalAreas = groups.reduce((sum, g) => sum + g.summary.total, 0);
  const totalAttention = groups.reduce((sum, g) => sum + g.summary.attention, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">Map</h1>
        {/* Suppressed when empty: "0 areas across 0 domains" is noise, and the
            empty state below already says everything worth saying. */}
        {groups.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {totalAreas} {totalAreas === 1 ? "area" : "areas"} across {groups.length}{" "}
            {groups.length === 1 ? "domain" : "domains"}
            {totalAttention > 0 && (
              <>
                {" · "}
                {/* The one coral element on this screen. Its force comes entirely
                    from being the only one — the per-domain counts are emphasised
                    by weight instead. */}
                <span className="font-medium text-tertiary">
                  {totalAttention} worth a look
                </span>
              </>
            )}
          </p>
        )}
        </div>

        {groups.length > 0 && (
          <div className="flex items-center">
            {namingDomain ? (
              <input
                autoFocus
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onBlur={addDomain}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDomain();
                  }
                  if (e.key === "Escape") {
                    setNamingDomain(false);
                    setNewDomain("");
                  }
                }}
                placeholder="Domain name"
                aria-label="Name the new domain"
                className={cn(
                  "min-h-11 rounded-md bg-transparent px-3 text-sm",
                  "placeholder:text-muted-foreground/70",
                  "focus:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                )}
              />
            ) : (
              <button
                type="button"
                onClick={() => setNamingDomain(true)}
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
        )}
      </header>

      {rendered.length === 0 ? (
        <MapEmptyState />
      ) : (
        // Domains are separated by whitespace alone — no rules, no dividers.
        <div className="mt-10 space-y-10">
          {rendered.map((group) => (
            <DomainGroup
              key={group.domain ?? "\u0000ungrouped"}
              group={group}
              expanded={!collapsed.has(group.domain)}
              onToggle={() => toggle(group.domain)}
              domains={domains}
            />
          ))}
        </div>
      )}
    </div>
  );
}
