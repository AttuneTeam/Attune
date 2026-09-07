"use client";

import { useState } from "react";
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
 */
export function SurfaceAreaMapClient({
  groups,
}: {
  groups: DomainGroupData<MapArea>[];
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const keyOf = (group: DomainGroupData<MapArea>) => group.domain ?? "ungrouped";

  const toggle = (key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalAreas = groups.reduce((sum, g) => sum + g.summary.total, 0);
  const totalAttention = groups.reduce((sum, g) => sum + g.summary.attention, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-8 sm:py-14">
      <header>
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
      </header>

      {groups.length === 0 ? (
        <MapEmptyState />
      ) : (
        // Domains are separated by whitespace alone — no rules, no dividers.
        <div className="mt-10 space-y-10">
          {groups.map((group) => {
            const key = keyOf(group);
            return (
              <DomainGroup
                key={key}
                group={group}
                expanded={!collapsed.has(key)}
                onToggle={() => toggle(key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
