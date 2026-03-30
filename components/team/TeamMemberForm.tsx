"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Team, TeamMember } from "@/lib/supabase/types";

interface Props {
  teams: Team[];
  managerId: string;
  existing?: TeamMember;
}

const LEVELS = ["junior", "mid", "senior", "staff", "principal", "director"];

export function TeamMemberForm({ teams, managerId, existing }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [level, setLevel] = useState(existing?.level ?? "");
  const [roleDescription, setRoleDescription] = useState(
    existing?.role_description ?? "",
  );
  const [startDate, setStartDate] = useState(existing?.start_date ?? "");
  const [skillsInput, setSkillsInput] = useState(
    (existing?.skills ?? []).join(", "),
  );
  const [teamId, setTeamId] = useState(existing?.team_id ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      if (existing) {
        const { error } = await supabase
          .from("team_members")
          .update({
            name,
            email: email || null,
            level: level || null,
            role_description: roleDescription || null,
            start_date: startDate || null,
            skills,
            team_id: teamId || null,
          })
          .eq("id", existing.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Team member updated");
      } else {
        const { error } = await supabase.from("team_members").insert({
          manager_id: managerId,
          name,
          email: email || null,
          level: level || null,
          role_description: roleDescription || null,
          start_date: startDate || null,
          skills,
          team_id: teamId || null,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Team member added");
      }
      setOpen(false);
      router.refresh();
    });
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (
      !confirm(
        `Delete ${existing.name}? This will also delete all their meetings.`,
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", existing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Team member deleted");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {existing ? (
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add member
            </Button>
          }
        />
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit team member" : "Add team member"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="level">Level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v ?? "")}>
                <SelectTrigger id="level">
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
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team">Team</Label>
              <Select
                value={teams.find((t) => t.id === teamId)?.name ?? ""}
                onValueChange={(v) => setTeamId(v ?? "")}
              >
                <SelectTrigger id="team">
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
              <Label htmlFor="role">Role description</Label>
              <Textarea
                id="role"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder="TypeScript, React, Go"
              />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            {existing && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : existing
                    ? "Save changes"
                    : "Add member"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
