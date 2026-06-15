"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plug, Pencil, ListPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberEditButton } from "@/components/team/MemberEditButton";
import { MemberIntegrationsForm } from "@/components/team/MemberIntegrationsForm";
import { ActionItemEditDialog } from "@/components/action-items/ActionItemEditDialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
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

const EMPTY_ACTION_ITEM = {
  id: "new",
  title: null,
  description: "",
  status: "open",
  due_date: null,
  assignee_id: null,
} as const;

export function MemberHeaderMenu({
  member,
  teams,
  roles,
  managerId,
  integrations,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [creatingInteraction, setCreatingInteraction] = useState(false);
  const router = useRouter();

  const handleNewInteraction = async () => {
    setCreatingInteraction(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreatingInteraction(false);
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
    if (!error && data) {
      router.push(`/interactions/${data.id}`);
    } else {
      toast.error("Failed to create interaction");
      setCreatingInteraction(false);
    }
  };

  const handleAddActionItem = async (updates: {
    title: string | null;
    description: string;
    due_date: string | null;
    status: string;
    assignee_id: string | null;
  }) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("action_items").insert({
      description: updates.description,
      title: updates.title,
      due_date: updates.due_date,
      status: updates.status,
      assignee_id: member.id,
      user_id: user?.id,
    });
    if (error) {
      toast.error("Failed to create action item");
      return;
    }
    toast.success("Action item added");
    setAddActionOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">More options</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={handleNewInteraction}
            disabled={creatingInteraction}
          >
            <Plus className="h-3 w-3" />
            {creatingInteraction ? "Creating…" : "New interaction"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAddActionOpen(true)}>
            <ListPlus className="h-3 w-3" />
            Add action item
          </DropdownMenuItem>
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

      <ActionItemEditDialog
        key={addActionOpen ? "open" : "closed"}
        item={
          addActionOpen
            ? { ...EMPTY_ACTION_ITEM, assignee_id: member.id }
            : null
        }
        hideAssignee
        onClose={() => setAddActionOpen(false)}
        onSave={handleAddActionItem}
      />

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
