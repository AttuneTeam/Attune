"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { TeamMemberForm } from "@/components/team/TeamMemberForm";
import type { Team, TeamMember, Role } from "@/lib/supabase/types";

interface Props {
  member: TeamMember;
  teams: Team[];
  roles: Role[];
}

export function TeamMemberRowMenu({ member, teams, roles }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleNewMeeting = async () => {
    setCreating(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from("interactions")
      .insert({
        participant_id: member.id,
        manager_id: user.id,
        scheduled_at: new Date().toISOString(),
        type: "scheduled",
      })
      .select("id")
      .single();

    if (error || !data) {
      toast.error("Failed to create interaction");
      setCreating(false);
      return;
    }
    router.push(`/interactions/${data.id}`);
  };

  return (
    <div className="flex items-center gap-1 justify-end">
      <TeamMemberForm
        existing={member}
        teams={teams}
        roles={roles}
        managerId={member.manager_id}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleNewMeeting} disabled={creating}>
            <Plus className="h-4 w-4" />
            {creating ? "Creating…" : "New interaction"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
