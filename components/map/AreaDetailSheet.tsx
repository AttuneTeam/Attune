"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StrategyTiptapEditor } from "@/components/strategies/StrategyTiptapEditor";
import { formatReviewAge } from "@/lib/map/attention";
import type { LinkedInteraction } from "@/lib/map/linkedInteractions";
import type { MapArea } from "@/lib/map/types";
import type { Json } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { AreaOwnerPicker, type OwnerOption } from "./AreaOwnerPicker";

/**
 * Everything about one area, behind progressive disclosure.
 *
 * The list answers "what should I pay attention to?"; this answers "what do I
 * know about this?". Notes reuse the editor that already writes `description`
 * on this table for initiatives — areas are rows in the same table, so there is
 * no second editor and no second save path to keep honest.
 *
 * Notes and linked conversations are fetched when the sheet opens rather than
 * with the map: a Tiptap document per row would move kilobytes across the whole
 * map for something only this panel reads.
 *
 * The fetch itself belongs to whoever opened the panel, not to an effect here.
 * Loading in response to the click that asked for it is both simpler — no
 * cancellation bookkeeping, no refetch guard — and what the React compiler
 * rule in this project requires.
 */

const SIGNAL_LABEL: Record<LinkedInteraction["signal"], string> = {
  advances: "advances",
  reinforces: "reinforces",
  threatens: "threatens",
};

/** Matches the compact notes editor so opening the drawer does not jump. */
function NotesSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading notes"
      className="relative min-h-40 rounded-md border border-input px-3 py-3 dark:border-border"
    >
      <span className="sr-only">Loading notes</span>
      <div className="space-y-3 animate-pulse">
        <div className="h-3 w-11/12 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="absolute inset-x-3 bottom-3 h-2 w-16 rounded bg-muted animate-pulse" />
    </div>
  );
}

export type AreaDetail = {
  description: Json | null
  linked: LinkedInteraction[]
}

export function AreaDetailSheet({
  area,
  members,
  detail,
  loading,
  failed,
  onRetry,
  onDescriptionSaved,
  open,
  onOpenChange,
}: {
  area: MapArea;
  members: readonly OwnerOption[];
  /** Loaded by whoever opened the sheet; null until it arrives. */
  detail: AreaDetail | null;
  loading: boolean;
  /** The load failed. Distinct from "still loading" and from "loaded, empty". */
  failed: boolean;
  onRetry: () => void;
  /** Keeps the caller's fetched drawer detail current after an auto-save. */
  onDescriptionSaved: (description: Json) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const linked = detail?.linked ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{area.title}</SheetTitle>
          <SheetDescription>
            {area.domain ?? "Ungrouped"} · {formatReviewAge(area)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 px-4 pb-8">
          <section>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Owner
            </p>
            <div className="mt-2">
              <AreaOwnerPicker
                areaId={area.id}
                areaTitle={area.title}
                ownerId={area.owner_id}
                ownedByManager={area.owned_by_manager}
                members={members}
                onChanged={() => router.refresh()}
              />
            </div>
          </section>

          <section>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Notes
            </p>
            <div className="mt-2">
              {failed ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    These notes could not be loaded. Nothing has been changed.
                  </p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className={cn(
                      "min-h-11 rounded-md px-3 text-[11px] font-medium text-primary",
                      "hover:bg-accent/30",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    )}
                  >
                    Try again
                  </button>
                </div>
              ) : loading || !detail ? (
                <NotesSkeleton />
              ) : (
                // Auto-saves with debounce. No Save button in the editing path
                // — zero-friction capture applies here as much as to quick-add.
                // Bordered like every other editable field here
                // (components/ui/input and textarea both use border-input) —
                // the no-1px-border rule governs sectioning the UI, not form
                // controls. Padding is a fraction of the full-page editor's:
                // in a drawer, 32px of gutter leaves almost no line length.
                //
                // dark:border-border because the sheet is bg-popover (#36402a)
                // and --input is #344023 in dark: near-identical, so the border
                // vanished. --border (#45502e) is a real step against it.
                <div className="rounded-md border border-input focus-within:border-ring dark:border-border">
                  <StrategyTiptapEditor
                    key={area.id}
                    initiativeId={area.id}
                    initialContent={detail.description}
                    onSaved={onDescriptionSaved}
                    contentClassName="min-h-40 px-3 py-2"
                    footerClassName="px-3 py-1.5"
                  />
                </div>
              )}
            </div>
          </section>

          <section>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Linked conversations
            </p>
            {failed ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Linked conversations could not be loaded.
              </p>
            ) : detail && linked.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No 1-on-1 has been linked to this area yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {linked.map((item) => (
                  <li key={item.interactionId}>
                    <Link
                      href={`/interactions/${item.interactionId}`}
                      className={cn(
                        "block rounded-md px-3 py-2 transition-colors hover:bg-accent/30",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      )}
                    >
                      <p className="text-sm">
                        {item.title ?? "Untitled"}
                        {item.participantName && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {item.participantName}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {/* The signal is shown plainly. Per FR6 it is context
                            here and deliberately does not drive the attention
                            mark on the map. */}
                        {SIGNAL_LABEL[item.signal]}
                        {item.note && ` · ${item.note}`}
                        {item.occurredAt &&
                          ` · ${format(new Date(item.occurredAt), "d MMM")}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
