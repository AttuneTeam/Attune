import { STALENESS_THRESHOLD_DAYS } from "@/lib/map/attention";

/**
 * What a manager sees before they have mapped anything.
 *
 * This is the screen that has to explain what an "area" is, because nothing
 * else on the page can. It says it in the product's voice — a peer explaining
 * the idea once, plainly — rather than as onboarding chirp.
 *
 * The suggested domains are text, not buttons. Capture arrives in Phase 3
 * (spec.md FR4), and a control that looked actionable and did nothing would be
 * worse than none. They become the quick-add's starting point once there is a
 * quick-add to start.
 */
export const STARTER_DOMAINS = ["Platform", "People", "Business", "Process"] as const;

export function MapEmptyState() {
  return (
    <div className="mt-10 rounded-lg bg-card p-6 sm:p-8">
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
          Domains to start from
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTER_DOMAINS.map((domain) => (
            <span
              key={domain}
              className="rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-secondary-foreground"
            >
              {domain}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Yours may be different — a domain is just a heading you choose.
        </p>
      </div>
    </div>
  );
}
