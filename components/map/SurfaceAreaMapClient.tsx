"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  persistCollapsedDomains,
  type CollapsedDomains,
} from "@/lib/map/collapse";
import { createDomain } from "@/lib/map/api";
import type { DomainGroup as DomainGroupData, DomainRef } from "@/lib/map/grouping";
import type { MapArea } from "@/lib/map/types";
import { cn } from "@/lib/utils";
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
  initialCollapsed = [],
}: {
  groups: DomainGroupData<MapArea>[];
  domains: DomainRef[];
  initialCollapsed?: (string | null)[];
}) {
  const [collapsed, setCollapsed] = useState<CollapsedDomains>(
    () => new Set(initialCollapsed),
  );
  const [namingDomain, setNamingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function toggle(domainId: string | null) {
    // Computed outside the updater: persisting inside it would fire twice
    // under StrictMode's double invocation.
    const next = new Set(collapsed);
    if (next.has(domainId)) next.delete(domainId);
    else next.add(domainId);
    setCollapsed(next);
    persistCollapsedDomains(next);
  }

  async function addDomain() {
    const trimmed = newDomain.trim();
    setNamingDomain(false);
    setNewDomain("");
    if (!trimmed || saving) return;

    setSaving(true);
    const result = await createDomain(trimmed);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
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

        {hasAnything && (
          <div className="flex items-center">
            {namingDomain ? (
              <input
                autoFocus
                value={newDomain}
                disabled={saving}
                onChange={(e) => setNewDomain(e.target.value)}
                onBlur={() => void addDomain()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addDomain();
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
              expanded={!collapsed.has(group.domainId)}
              onToggle={() => toggle(group.domainId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
