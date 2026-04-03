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
import type { Team } from "@/lib/supabase/types";

interface Props {
  teams: Team[];
  managerId: string;
  existing?: Team;
}

export function TeamForm({ teams, managerId, existing }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [name, setName] = useState(existing?.name ?? "");
  const [parentId, setParentId] = useState(existing?.parent_id ?? "");

  // Teams that can be parents (exclude self and descendants to prevent cycles)
  const parentOptions = teams.filter((t) => t.id !== existing?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();

    startTransition(async () => {
      if (existing) {
        const { error } = await supabase
          .from("teams")
          .update({ name, parent_id: parentId || null })
          .eq("id", existing.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Team updated");
      } else {
        const { error } = await supabase
          .from("teams")
          .insert({ manager_id: managerId, name, parent_id: parentId || null });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Team created");
      }
      setOpen(false);
      router.refresh();
    });
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (
      !confirm(
        `Delete team "${existing.name}"? Members will be unassigned from it.`,
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", existing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Team deleted");
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
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add team
            </Button>
          }
        />
      )}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit team" : "Create team"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team name *</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Platform, Frontend, Infra"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="parent-team">Parent team</Label>
            <Select
              value={parentOptions.find((po) => po.id === parentId)?.name}
              onValueChange={(v) => setParentId(v ?? "")}
            >
              <SelectTrigger id="parent-team">
                <SelectValue placeholder="No parent (top-level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No parent (top-level)</SelectItem>
                {parentOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    : "Create team"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
