"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDomain, renameDomain } from "@/lib/map/api";

/**
 * Creating and renaming a domain.
 *
 * One dialog for both, because they are the same act from the manager's side —
 * naming a territory — and two near-identical forms would drift apart. The
 * inline field this replaces was fine for a quick add but had nowhere to put a
 * validation message, so a duplicate name failed into a toast that vanished.
 */
export function DomainDialog({
  open,
  onOpenChange,
  /** Omit to create; pass a domain to rename it. */
  domain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain?: { id: string; name: string };
}) {
  const isRename = domain !== undefined;
  const [name, setName] = useState(domain?.name ?? "");
  const [saving, setSaving] = useState(false);
  // Shown in the dialog rather than a toast: the manager is looking here, and
  // the fix is in the field right above it.
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function close(next: boolean) {
    if (!next) {
      setName(domain?.name ?? "");
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);
    const result = isRename
      ? await renameDomain(domain.id, trimmed)
      : await createDomain(trimmed);
    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onOpenChange(false);
    if (!isRename) setName("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isRename ? "Rename domain" : "New domain"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="domain-name">Name</Label>
            <Input
              id="domain-name"
              autoFocus
              value={name}
              disabled={saving}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Platform"
            />
            {error && (
              <p role="alert" className="text-[11px] text-destructive">
                {error}
              </p>
            )}
            {isRename && (
              <p className="text-[11px] text-muted-foreground">
                Every area in this domain moves with it.
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={saving || name.trim().length === 0}>
              {saving ? "Saving" : isRename ? "Rename" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
