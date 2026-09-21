"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { STALENESS_THRESHOLD_DAYS } from "@/lib/map/attention";
import { createDomain } from "@/lib/map/api";
import { cn } from "@/lib/utils";
import { InlineAreaAdd } from "./InlineAreaAdd";

/**
 * What a manager sees before they have mapped anything.
 *
 * This is the screen that has to explain what an "area" is, because nothing
 * else on the page can. It says it in the product's voice — a peer explaining
 * the idea once, plainly — rather than as onboarding chirp.
 *
 * The starters create a real domain now that domains are rows (FR10), rather
 * than choosing a label for the first area. That is the honest behaviour: the
 * manager is framing a territory, and the group should exist whether or not
 * they fill it immediately.
 */
export const STARTER_DOMAINS = ["Platform", "People", "Business", "Process"] as const;

export function MapEmptyState() {
  const [creating, setCreating] = useState<string | null>(null);
  const router = useRouter();

  async function addDomain(name: string) {
    if (creating) return;
    setCreating(name);
    const result = await createDomain(name);
    setCreating(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-lg bg-card p-5 sm:p-6">
      <h2 className="font-heading text-lg tracking-tight">Nothing mapped yet</h2>

      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        An area is anything you are accountable for — a part of the platform, a hire
        you need to make, a relationship you have not built yet. Record how well you
        hold each one, and the map will show you where you are thin.
      </p>

      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Anything you have not reviewed in {STALENESS_THRESHOLD_DAYS} days, or that
        nobody owns, surfaces on its own.
      </p>

      <div className="mt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Start with a domain
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTER_DOMAINS.map((starter) => (
            <button
              key={starter}
              type="button"
              disabled={creating !== null}
              onClick={() => void addDomain(starter)}
              className={cn(
                "min-h-11 rounded-full bg-secondary px-4 text-[11px] font-medium",
                "text-secondary-foreground transition-colors hover:bg-accent",
                "disabled:opacity-50",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              {creating === starter ? `Adding ${starter}` : starter}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Yours may be different — a domain is just a heading you choose, and you can
          rename or remove it later.
        </p>
      </div>

      <div className="mt-8 max-w-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Or add an area without one
        </p>
        {/* Ungrouped is a legitimate place to start: capture must never be
            blocked on choosing a heading first. */}
        <div className="mt-2">
          <InlineAreaAdd domainId={null} placeholder="Add your first area" />
        </div>
      </div>
    </div>
  );
}
