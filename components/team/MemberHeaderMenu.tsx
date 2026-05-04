"use client";

import { useState } from "react";
import { MoreHorizontal, Plug, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberEditButton } from "@/components/team/MemberEditButton";
import { MemberIntegrationsForm } from "@/components/team/MemberIntegrationsForm";
import type {
  Team,
  TeamMember,
  Role,
  MemberIntegration,
} from "@/lib/supabase/types";

interface Props {
  member: TeamMember;
  teams: Team[];
  roles: Role[];
  managerId: string;
  integrations: MemberIntegration[];
}

export function MemberHeaderMenu({
  member,
  teams,
  roles,
  managerId,
  integrations,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIntegrationsOpen(true)}>
            <Plug className="h-3 w-3" />
            Integrations
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-3 w-3" />
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MemberIntegrationsForm
        memberId={member.id}
        managerId={managerId}
        integrations={integrations}
        open={integrationsOpen}
        onOpenChange={setIntegrationsOpen}
      />
      <MemberEditButton
        member={member}
        teams={teams}
        roles={roles}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
