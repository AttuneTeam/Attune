"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONFIDENCE_ORDER } from "@/lib/map/coverage";
import { updateArea } from "@/lib/map/api";
import { cn } from "@/lib/utils";
import type { AreaConfidence } from "@/lib/supabase/types";

/**
 * Sets how well the manager holds an area, and records a review.
 *
 * The confidence chip is itself the control — no separate edit affordance, no
 * dialog. FR3 asks for this to be settable from the row without opening
 * anything, because a manager reassessing their map will touch several in a
 * row and each modal would be a reason to stop.
 *
 * "Mark as reviewed" lives in the same menu rather than on the review age
 * itself. Making the staleness figure clickable would be more elegant and much
 * worse: an accidental click would silently reset a 24-day signal, destroying
 * exactly the information the map exists to keep. A menu item is deliberate.
 */

const CONFIDENCE_LABEL: Record<AreaConfidence, string> = {
  unknown: "Unknown",
  aware: "Aware",
  understood: "Understood",
  owned: "Owned",
};

/**
 * `unknown` sits on the muted surface rather than the secondary one: it is the
 * absence of a judgement, and giving it the same chip weight as a real
 * confidence level would overstate it.
 */
const CONFIDENCE_CHIP: Record<AreaConfidence, string> = {
  unknown: "bg-muted text-muted-foreground",
  aware: "bg-secondary text-secondary-foreground",
  understood: "bg-secondary text-secondary-foreground",
  owned: "bg-secondary text-secondary-foreground",
};

export function ConfidenceControl({
  areaId,
  areaTitle,
  confidence,
}: {
  areaId: string;
  areaTitle: string;
  confidence: AreaConfidence;
}) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function apply(patch: { confidence: AreaConfidence } | { reviewed: true }) {
    if (saving) return;
    setSaving(true);
    const result = await updateArea(areaId, patch);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={saving}
            title="Set how well you hold this area"
            className={cn(
              // relative anchors the sr-only label below. Tailwind's sr-only is
              // position:absolute, and with no positioned ancestor it resolves
              // against the initial containing block -- extending the document
              // rather than the scroll container, which put a second scrollbar
              // on the page.
              "relative rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
              "hover:opacity-80 disabled:opacity-50",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              CONFIDENCE_CHIP[confidence],
            )}
          >
            {CONFIDENCE_LABEL[confidence]}
            <span className="sr-only"> — confidence in {areaTitle}</span>
          </button>
        }
      />
      <DropdownMenuContent>
        {CONFIDENCE_ORDER.map((level) => (
          <DropdownMenuItem
            key={level}
            onClick={() => void apply({ confidence: level })}
            className={level === confidence ? "font-medium" : ""}
          >
            {level === confidence ? (
              <Check className="size-3.5" />
            ) : (
              <span className="size-3.5" />
            )}
            {CONFIDENCE_LABEL[level]}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Names the column it changes. "Mark as reviewed" left the manager
            guessing what was being recorded; the map tracks when each area was
            last looked at, and anything untouched for the staleness threshold
            surfaces on its own. */}
        <DropdownMenuItem onClick={() => void apply({ reviewed: true })}>
          <Eye className="size-3.5" />
          Reviewed today
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
