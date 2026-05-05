"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Target, Network } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OrgTreeDisplay } from "@/components/dashboard/OrgStructureSheet";
import type { Team, TeamMember } from "@/lib/supabase/types";

interface Props {
  teams: Team[];
  members: TeamMember[];
}

export function DashboardOverflowMenu({ teams, members }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);

  const handleNewInitiative = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/initiatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed");
      const { id } = await res.json();
      router.push(`/initiatives/${id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleNewInitiative} disabled={creating}>
            <Target className="h-4 w-4" />
            {creating ? "Creating…" : "New initiative"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOrgOpen(true)}>
            <Network className="h-4 w-4" />
            Org chart
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={orgOpen} onOpenChange={setOrgOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto p-0 gap-0">
          <SheetHeader className="border-b px-6 py-4 sticky top-0 bg-popover z-10">
            <SheetTitle>Org Structure</SheetTitle>
          </SheetHeader>
          <div className="px-6 py-6">
            <OrgTreeDisplay teams={teams} members={members} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
