"use client";

import { Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import type { Team, TeamMember } from "@/lib/supabase/types";

interface Props {
  teams: Team[];
  members: TeamMember[];
}

function OrgNode({
  teams,
  members,
  parentId = null,
  depth = 0,
}: {
  teams: Team[];
  members: TeamMember[];
  parentId?: string | null;
  depth?: number;
}) {
  const children = teams.filter((t) => t.parent_id === parentId);
  if (children.length === 0) return null;

  return (
    <ul className={depth === 0 ? "space-y-5" : "ml-6 mt-3 space-y-4 border-l border-border/60 pl-5"}>
      {children.map((team) => {
        const teamMembers = members.filter((m) => m.team_id === team.id);
        return (
          <li key={team.id}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-primary/70 shrink-0" />
              <span className="text-sm font-semibold tracking-tight">
                {team.name}
              </span>
              {teamMembers.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {teamMembers.length > 0 && (
              <div className="ml-4 flex flex-wrap gap-2">
                {teamMembers.map((m) => (
                  <Link
                    key={m.id}
                    href={`/team/${m.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <span>{m.name}</span>
                    {m.level && (
                      <span className="text-muted-foreground capitalize">
                        · {m.level}
                      </span>
                    )}
                    {m.is_squad_lead && (
                      <span className="text-primary font-semibold">· Lead</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
            <OrgNode
              teams={teams}
              members={members}
              parentId={team.id}
              depth={depth + 1}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function OrgTreeDisplay({ teams, members }: Props) {
  const unassigned = members.filter((m) => !m.team_id);

  return (
    <div className="space-y-8">
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No teams defined yet. Add teams from the Team page.
        </p>
      ) : (
        <OrgNode teams={teams} members={members} />
      )}

      {unassigned.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
            <span className="text-sm font-semibold text-muted-foreground tracking-tight">
              Unassigned
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((m) => (
              <Link
                key={m.id}
                href={`/team/${m.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
              >
                <span>{m.name}</span>
                {m.level && (
                  <span className="text-muted-foreground capitalize">
                    · {m.level}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function OrgStructureSheet({ teams, members }: Props) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <Network className="h-4 w-4" />
            Org chart
          </Button>
        }
      />

      <SheetContent className="sm:max-w-xl overflow-y-auto p-0 gap-0">
        <SheetHeader className="border-b px-6 py-4 sticky top-0 bg-popover z-10">
          <SheetTitle>Org Structure</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-6">
          <OrgTreeDisplay teams={teams} members={members} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
