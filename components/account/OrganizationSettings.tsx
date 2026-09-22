"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type ManagedOrganization = {
  id: string;
  name: string;
  archived_at: string | null;
  role: string;
};

function OrganizationRow({
  organization,
  organizations,
  isCurrent,
  canArchive,
}: {
  organization: ManagedOrganization;
  organizations: ManagedOrganization[];
  isCurrent: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [pending, setPending] = useState(false);
  const isOwner = organization.role === "owner";
  const isArchived = organization.archived_at !== null;

  async function rename() {
    const trimmedName = name.trim();
    if (!isOwner || !trimmedName || trimmedName === organization.name) return;

    setPending(true);
    try {
      const { error } = await createClient().rpc("rename_organization", {
        p_organization_id: organization.id,
        p_name: trimmedName,
      });
      if (error) throw error;
      toast.success("Organisation renamed");
      router.refresh();
    } catch {
      toast.error("Could not rename organisation");
    } finally {
      setPending(false);
    }
  }

  async function toggleArchive() {
    if (!isOwner) return;
    if (!isArchived && !canArchive) return;
    if (!isArchived && !window.confirm(
      `Archive “${organization.name}”? Its data will be kept, and the organisation will be hidden until you restore it.`,
    )) return;

    setPending(true);
    try {
      const { error } = await createClient().rpc("set_organization_archived", {
        p_organization_id: organization.id,
        p_archived: !isArchived,
      });
      if (error) throw error;

      let workspaceSwitchFailed = false;
      if (!isArchived && isCurrent) {
        const nextActive = organizations.find(
          (candidate) => candidate.id !== organization.id && candidate.archived_at === null,
        );
        if (nextActive) {
          try {
            const response = await fetch("/api/organizations/active", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ organizationId: nextActive.id }),
            });
            workspaceSwitchFailed = !response.ok;
          } catch {
            workspaceSwitchFailed = true;
          }
        }
      }

      toast.success(isArchived ? "Organisation restored" : "Organisation archived");
      if (workspaceSwitchFailed) toast.error("Could not switch workspaces; the sidebar will select an active one");
      router.refresh();
    } catch {
      toast.error(isArchived ? "Could not restore organisation" : "Could not archive organisation");
    } finally {
      setPending(false);
    }
  }

  return (
    <tr className="border-t">
      <td className="p-3 min-w-56">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            readOnly={!isOwner}
            aria-label={`Name for ${organization.name}`}
            className="min-w-36"
          />
          {isOwner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={rename}
              disabled={pending || !name.trim() || name.trim() === organization.name}
            >
              Rename
            </Button>
          )}
        </div>
      </td>
      <td className="p-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Badge variant={isArchived ? "secondary" : "outline"}>
            {isArchived ? "Archived" : "Active"}
          </Badge>
          {isCurrent && <span className="text-xs text-muted-foreground">Current</span>}
        </div>
      </td>
      <td className="p-3 text-right whitespace-nowrap">
        {isOwner && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleArchive}
            disabled={pending || (!isArchived && !canArchive)}
            title={!isArchived && !canArchive ? "Keep at least one active organisation" : undefined}
          >
            {isArchived ? "Restore" : "Archive"}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function OrganizationSettings({
  organizations,
  activeOrganizationId,
}: {
  organizations: ManagedOrganization[];
  activeOrganizationId: string | null;
}) {
  const activeCount = organizations.filter((organization) => organization.archived_at === null).length;

  return (
    <section className="rounded-lg border bg-card">
      <div className="p-5 space-y-1">
        <h2 className="text-sm font-semibold">Organisations</h2>
        <p className="text-xs text-muted-foreground">
          Rename, archive, and restore your workspaces. Archived organisations keep their data and can be restored here.
        </p>
      </div>
      {activeCount === 1 && (
        <p className="px-5 pb-3 text-xs text-muted-foreground">
          Keep at least one active organisation. Restore another before archiving this one.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <OrganizationRow
                key={`${organization.id}:${organization.name}:${organization.archived_at ?? "active"}`}
                organization={organization}
                organizations={organizations}
                isCurrent={organization.id === activeOrganizationId && organization.archived_at === null}
                canArchive={activeCount > 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
