"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { summariseAcceptOutcome } from "@/lib/map/acceptOutcome";
import { createArea, createDomain } from "@/lib/map/api";
import type { AreaSuggestion } from "@/lib/map/suggestSchema";
import type { DomainRef } from "@/lib/map/grouping";
import { cn } from "@/lib/utils";

/**
 * Bulk capture: paste what is in your head, get a proposed set of areas.
 *
 * The proposal is a draft the manager edits, not a result they receive.
 * Nothing reaches the database until they press accept, and discarding leaves
 * no trace — "AI is offered, never imposed" (product-guidelines.md UX
 * principle 3) is the whole shape of this screen.
 */

type Draft = AreaSuggestion & { keep: boolean };

const UNGROUPED = "\u0000ungrouped";

export function BrainDumpSheet({
  domains,
  open,
  onOpenChange,
}: {
  domains: readonly DomainRef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const router = useRouter();

  const kept = drafts?.filter((d) => d.keep) ?? [];

  function reset() {
    setText("");
    setDrafts(null);
    setProgress(null);
  }

  async function suggest() {
    if (thinking || text.trim().length < 20) return;
    setThinking(true);
    try {
      const res = await fetch("/api/map/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // Plain, calm, and the typed text is left exactly where it was.
        toast.error(body?.error ?? "Suggestions are unavailable right now.");
        return;
      }
      const areas = (body?.areas ?? []) as AreaSuggestion[];
      if (areas.length === 0) {
        toast("Nothing in there looked like a distinct area. Try adding more detail.");
        return;
      }
      setDrafts(areas.map((a) => ({ ...a, keep: true })));
    } catch {
      toast.error("Suggestions are unavailable right now. Nothing has been changed.");
    } finally {
      setThinking(false);
    }
  }

  async function accept() {
    if (!drafts || kept.length === 0 || progress) return;

    // Any domain the model proposed that does not exist yet has to be created
    // before the areas can reference it.
    const byName = new Map(domains.map((d) => [d.name, d.id]));
    const missing = [...new Set(kept.map((d) => d.domain).filter((d): d is string => !!d))].filter(
      (name) => !byName.has(name),
    );

    setProgress({ done: 0, total: kept.length });

    // A domain that fails to create would otherwise leave its areas filed as
    // ungrouped with no mention of it — the manager accepted a grouped
    // proposal and would silently receive a flat one.
    const failedDomains: string[] = [];
    for (const name of missing) {
      const created = await createDomain(name);
      if (created.ok && created.id) byName.set(name, created.id);
      else failedDomains.push(name);
    }

    let added = 0;
    let failed = 0;
    for (const [i, draft] of kept.entries()) {
      const result = await createArea({
        title: draft.title,
        domain_id: draft.domain ? (byName.get(draft.domain) ?? null) : null,
      });
      if (result.ok) added += 1;
      else failed += 1;
      setProgress({ done: i + 1, total: kept.length });
    }

    setProgress(null);
    onOpenChange(false);
    reset();
    router.refresh();

    // Reports what actually happened, including the parts that did not.
    const outcome = summariseAcceptOutcome({ added, failed, failedDomains });
    if (outcome.ok) toast.success(outcome.message);
    else toast.error(outcome.message);
  }

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((current) =>
      current ? current.map((d, i) => (i === index ? { ...d, ...patch } : d)) : current,
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Discarding leaves no trace, which is the point.
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Brain dump</SheetTitle>
          <SheetDescription>
            Write down everything you are carrying. Nothing is saved until you say so.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          {drafts === null ? (
            <>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={thinking}
                rows={12}
                placeholder="need to understand the payments service, agency still owns deploys, hire 2 seniors by Q2, board wants a tech strategy..."
                aria-label="What is on your mind"
              />
              <Button onClick={() => void suggest()} disabled={thinking || text.trim().length < 20}>
                {thinking ? "Reading" : "Suggest areas"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {kept.length} of {drafts.length} selected. Edit anything before adding.
              </p>

              <ul className="space-y-2">
                {drafts.map((draft, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-md px-2 py-1",
                      !draft.keep && "opacity-40",
                    )}
                  >
                    <input
                      value={draft.title}
                      onChange={(e) => update(i, { title: e.target.value })}
                      aria-label={`Title for suggestion ${i + 1}`}
                      className={cn(
                        "min-h-11 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm",
                        "focus:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      )}
                    />
                    <select
                      value={draft.domain ?? UNGROUPED}
                      onChange={(e) =>
                        update(i, {
                          domain: e.target.value === UNGROUPED ? null : e.target.value,
                        })
                      }
                      aria-label={`Domain for suggestion ${i + 1}`}
                      className={cn(
                        // bg-background/text-foreground rather than transparent:
                        // the other native selects in this codebase set both, and
                        // a transparent control inherits whatever the platform
                        // picks in the olive dark theme.
                        "min-h-11 rounded-md bg-background px-2 text-[11px] text-foreground",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      )}
                    >
                      {/* The proposed domain may be new, so it is offered
                          alongside the existing ones rather than instead. */}
                      {draft.domain && !domains.some((d) => d.name === draft.domain) && (
                        <option value={draft.domain}>{draft.domain} (new)</option>
                      )}
                      {domains.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                      <option value={UNGROUPED}>Ungrouped</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => update(i, { keep: !draft.keep })}
                      aria-pressed={!draft.keep}
                      title={draft.keep ? "Leave this one out" : "Put this one back"}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-md",
                        "text-muted-foreground/50 transition-colors",
                        "hover:bg-accent/30 hover:text-destructive",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      )}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">
                        {draft.keep ? "Leave out" : "Put back"} {draft.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => void accept()}
                  disabled={kept.length === 0 || progress !== null}
                >
                  {progress
                    ? `Adding ${progress.done} of ${progress.total}`
                    : `Add ${kept.length} ${kept.length === 1 ? "area" : "areas"}`}
                </Button>
                <Button variant="outline" onClick={reset} disabled={progress !== null}>
                  Discard
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
