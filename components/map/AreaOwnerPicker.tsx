"use client";

import { useState } from "react";
import { Check, User } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateArea } from "@/lib/map/api";
import { cn } from "@/lib/utils";

/**
 * Who holds an area.
 *
 * Three states, deliberately distinct: someone else's, mine, nobody's. Without
 * "mine", a personal map would file most of its areas under nobody and the
 * unowned mark would stop meaning anything — which is the whole reason FR8
 * exists.
 *
 * Assigning an owner is a record for the manager's own thinking. It notifies
 * nobody, creates no action item, and is never surfaced to the person named.
 */

export type OwnerOption = { id: string; name: string };

export function AreaOwnerPicker({
  areaId,
  areaTitle,
  ownerId,
  ownedByManager,
  members,
  onChanged,
}: {
  areaId: string;
  areaTitle: string;
  ownerId: string | null;
  ownedByManager: boolean;
  members: readonly OwnerOption[];
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const current = ownedByManager
    ? "Me"
    : (members.find((m) => m.id === ownerId)?.name ?? "Unowned");

  async function assign(patch: { owner_id: string | null } | { owned_by_manager: true }) {
    if (saving) return;
    setSaving(true);
    const result = await updateArea(areaId, patch);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    onChanged();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={saving}
            title={`Set who owns ${areaTitle}`}
            className={cn(
              "relative flex min-h-11 items-center gap-2 rounded-md px-3 text-sm",
              "transition-colors hover:bg-accent/30 disabled:opacity-50",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              ownerId === null && !ownedByManager && "text-muted-foreground",
            )}
          >
            <User className="size-3.5" />
            {current}
            <span className="sr-only"> — owner of {areaTitle}</span>
          </button>
        }
      />
      <DropdownMenuContent>
        {/* First, because on a personal map it is the most common answer. */}
        <DropdownMenuItem onClick={() => void assign({ owned_by_manager: true })}>
          {ownedByManager ? <Check className="size-3.5" /> : <span className="size-3.5" />}
          Me
        </DropdownMenuItem>

        {members.length > 0 && <DropdownMenuSeparator />}

        {members.map((member) => (
          <DropdownMenuItem
            key={member.id}
            onClick={() => void assign({ owner_id: member.id })}
            className={member.id === ownerId ? "font-medium" : ""}
          >
            {member.id === ownerId ? (
              <Check className="size-3.5" />
            ) : (
              <span className="size-3.5" />
            )}
            {member.name}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => void assign({ owner_id: null })}>
          {ownerId === null && !ownedByManager ? (
            <Check className="size-3.5" />
          ) : (
            <span className="size-3.5" />
          )}
          Nobody yet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
