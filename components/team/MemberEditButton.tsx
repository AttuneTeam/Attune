"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Team, TeamMember, Role } from "@/lib/supabase/types";

const LEVELS = ["junior", "mid", "senior", "staff", "principal", "director"];

export function MemberEditButton({
  member,
  teams,
  roles,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  member: TeamMember;
  teams: Team[];
  roles: Role[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? "");
  const [level, setLevel] = useState(member.level ?? "");
  const [roleDescription, setRoleDescription] = useState(
    member.role_description ?? "",
  );
  const [startDate, setStartDate] = useState(member.start_date ?? "");
  const [skillsInput, setSkillsInput] = useState(
    (member.skills ?? []).join(", "),
  );
  const [teamId, setTeamId] = useState(member.team_id ?? "");
  const [roleId, setRoleId] = useState(member.role_id ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      const { error } = await supabase
        .from("team_members")
        .update({
          name,
          email: email || null,
          level: level || null,
          role_description: roleDescription || null,
          role_id: roleId || null,
          start_date: startDate || null,
          skills,
          team_id: teamId || null,
        })
        .eq("id", member.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Details updated");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      {!isControlled && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {member.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="meb-name">Name *</Label>
                <Input
                  id="meb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meb-email">Email</Label>
                <Input
                  id="meb-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meb-level">Level</Label>
                <Select value={level} onValueChange={(v) => setLevel(v ?? "")}>
                  <SelectTrigger id="meb-level">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l} className="capitalize">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="meb-role-id">Role</Label>
                <Select value={roleId} onValueChange={(v) => setRoleId(v ?? "")}>
                  <SelectTrigger id="meb-role-id">
                    <SelectValue placeholder="No role assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No role assigned</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meb-start">Start date</Label>
                <Input
                  id="meb-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meb-team">Team</Label>
                <Select
                  value={teams.find((t) => t.id === teamId)?.name ?? ""}
                  onValueChange={(v) => setTeamId(v ?? "")}
                >
                  <SelectTrigger id="meb-team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No team</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="meb-role">Role description</Label>
                <Textarea
                  id="meb-role"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="meb-skills">Skills (comma-separated)</Label>
                <Input
                  id="meb-skills"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="TypeScript, React, Go"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
