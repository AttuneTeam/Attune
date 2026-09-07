"use client";

import { useState } from "react";
import { STALENESS_THRESHOLD_DAYS } from "@/lib/map/attention";
import { cn } from "@/lib/utils";
import { InlineAreaAdd } from "./InlineAreaAdd";

/**
 * What a manager sees before they have mapped anything.
 *
 * This is the screen that has to explain what an "area" is, because nothing
 * else on the page can. It says it in the product's voice — a peer explaining
 * the idea once, plainly — rather than as onboarding chirp.
 *
 * The starter domains pick where the first area lands. They are a suggestion,
 * not a taxonomy: domains are free text, and a manager who wants "Board" or
 * "Delivery" should not feel they are working around the product.
 */
export const STARTER_DOMAINS = ["Platform", "People", "Business", "Process"] as const;

export function MapEmptyState() {
  // null means ungrouped, which is a legitimate place to start — capture must
  // never be blocked on choosing a heading first.
  const [domain, setDomain] = useState<string | null>(null);

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
          Start in
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTER_DOMAINS.map((starter) => {
            const active = domain === starter;
            return (
              <button
                key={starter}
                type="button"
                aria-pressed={active}
                onClick={() => setDomain(active ? null : starter)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-[11px] font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {starter}
              </button>
            );
          })}
        </div>

        <div className="mt-4 max-w-xl">
          <InlineAreaAdd
            domain={domain}
            placeholder={
              domain ? `Add an area to ${domain}` : "Add your first area"
            }
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Yours may be different — a domain is just a heading you choose, and you can
          leave it off entirely.
        </p>
      </div>
    </div>
  );
}
