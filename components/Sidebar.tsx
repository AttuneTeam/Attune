"use client";

import { Press_Start_2P } from "next/font/google";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Settings,
  Network,
  Briefcase,
  ChevronDown,
  BookOpen,
  Target,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { AttuneLogo } from "./marketing/MarketingNav";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/team-pulse", label: "Team", icon: Activity },
  { href: "/strategies", label: "Strategies", icon: Target },
];

const settingsItems = [
  { href: "/settings/org", label: "Organisation", icon: Network },
  { href: "/team", label: "Team", icon: Users },
  { href: "/roles", label: "Roles", icon: Briefcase },
  { href: "/settings/knowledge", label: "Knowledge", icon: BookOpen },
];

type Member = { id: string; name: string; relationship?: string | null };

export function Sidebar({
  profile,
  members,
}: {
  profile: Profile | null;
  members: Member[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [peopleOpen, setPeopleOpen] = useState(true);
  const [stakeholdersOpen, setStakeholdersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/roles") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/team"),
  );

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "U";

  const isSettingsActive =
    pathname.startsWith("/roles") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/team");

  return (
    <aside className="w-56 flex flex-col bg-sidebar shrink-0">
      <div className={`mx-2 my-4 px-4 py-2 rounded-lg`}>
        <AttuneLogo />
      </div>
      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                active
                  ? "text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              style={
                active
                  ? {
                      background:
                        "linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))",
                    }
                  : undefined
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* People quick-access */}
        {(() => {
          const directReports = members.filter(
            (m) => m.relationship !== "stakeholder",
          );
          const stakeholders = members.filter(
            (m) => m.relationship === "stakeholder",
          );
          return (
            <>
              {directReports.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setPeopleOpen((o) => !o)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">People</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                        peopleOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {peopleOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-border/50 space-y-0.5">
                      {directReports.map((member) => {
                        const active = pathname === `/team/${member.id}`;
                        return (
                          <Link
                            key={member.id}
                            href={`/team/${member.id}`}
                            className={cn(
                              "block px-2 py-1.5 rounded-md text-xs transition-colors truncate",
                              active
                                ? "font-medium text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent",
                            )}
                          >
                            {member.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {stakeholders.length > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setStakeholdersOpen((o) => !o)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                  >
                    <Network className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">Stakeholders</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                        stakeholdersOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {stakeholdersOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-border/50 space-y-0.5">
                      {stakeholders.map((member) => {
                        const active = pathname === `/team/${member.id}`;
                        return (
                          <Link
                            key={member.id}
                            href={`/team/${member.id}`}
                            className={cn(
                              "block px-2 py-1.5 rounded-md text-xs transition-colors truncate",
                              active
                                ? "font-medium text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent",
                            )}
                          >
                            {member.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}

        {/* Settings section */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
              isSettingsActive
                ? "text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Settings</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                settingsOpen && "rotate-180",
              )}
            />
          </button>
          {settingsOpen && (
            <div className="mt-0.5 ml-3 pl-3 border-l border-border/50 space-y-0.5">
              {settingsItems.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
                      active
                        ? "font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* User footer */}
      <div className="p-3 flex items-center gap-3">
        <Link
          href="/account"
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {profile?.full_name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {profile?.role}
            </p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleSignOut}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
