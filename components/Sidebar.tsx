"use client";

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
  UserPlus,
  FlaskConical,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { AttuneLogo } from "./marketing/MarketingNav";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMobileNav } from "@/components/layout/MobileNavContext";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  // { href: "/team-pulse", label: "Team", icon: Activity },
  // { href: "/initiatives", label: "Initiatives", icon: Target },
  // { href: "/workshop", label: "Workshop", icon: FlaskConical },
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
  defaultCollapsed = false,
}: {
  profile: Profile | null;
  members: Member[];
  defaultCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { close: closeMobileNav } = useMobileNav();
  const [userCollapsed, setUserCollapsed] = useState(defaultCollapsed);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 479px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const collapsed = userCollapsed && !isMobile;

  useEffect(() => {
    if (!isMobile) {
      document.cookie = `sidebar-collapsed=${userCollapsed}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [userCollapsed, isMobile]);

  const [peopleOpen, setPeopleOpen] = useState(true);
  const [stakeholdersOpen, setStakeholdersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/roles") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/team"),
  );
  const [openFlyout, setOpenFlyout] = useState<
    "people" | "stakeholders" | "settings" | null
  >(null);

  useEffect(() => {
    setOpenFlyout(null);
  }, [pathname]);

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

  const directReports = members.filter((m) => m.relationship !== "stakeholder");
  const stakeholders = members.filter((m) => m.relationship === "stakeholder");

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "h-full flex flex-col bg-sidebar shrink-0 transition-[width] duration-300 ease-in-out",
          collapsed ? "w-16" : "w-56",
        )}
      >
        {/* Logo + collapse toggle */}
        <div
          className={cn(
            "mx-2 my-4 rounded-lg flex items-center gap-2 justify-between",
            collapsed ? "px-2 py-2 justify-center" : "px-2 py-2 pr-0",
          )}
        >
          {!collapsed && <AttuneLogo />}
          {!isMobile ? (
            <button
              type="button"
              onClick={() => setUserCollapsed((o) => !o)}
              className={cn(
                "p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
                !collapsed && "ml-auto",
              )}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={closeMobileNav}
              className="text-xs p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Close
            </button>
          )}
        </div>

        {/* Nav */}
        <nav
          className={cn(
            "flex-1 py-4 px-2 space-y-0.5",
            collapsed ? "overflow-visible" : "overflow-y-auto",
          )}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            const link = (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  collapsed && "justify-center px-0",
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
                {!collapsed && label}
              </Link>
            );
            if (!collapsed) return link;
            return (
              <Tooltip key={href}>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}

          {/* People quick-access */}
          {directReports.length > 0 && (
            <div className={cn("pt-2", collapsed && "relative group/people")}>
              <button
                type="button"
                onClick={() =>
                  collapsed
                    ? setOpenFlyout((o) => (o === "people" ? null : "people"))
                    : setPeopleOpen((o) => !o)
                }
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all",
                  collapsed && "justify-center px-0",
                )}
                title={collapsed ? "People" : undefined}
              >
                <Users className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">People</span>
                    <Link
                      href="/team"
                      onClick={(e) => e.stopPropagation()}
                      className="p-0.5 rounded hover:bg-accent/80 hover:text-foreground text-muted-foreground/60 transition-colors"
                      title="Add team member"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Link>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                        peopleOpen && "rotate-180",
                      )}
                    />
                  </>
                )}
              </button>

              {/* Expanded sub-items */}
              {!collapsed && peopleOpen && (
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

              {/* Collapsed flyout */}
              {collapsed && (
                <div
                  className={cn(
                    "absolute left-full top-0 pl-2 z-50 transition-opacity duration-150",
                    openFlyout === "people"
                      ? "visible opacity-100 pointer-events-auto"
                      : "invisible group-hover/people:visible opacity-0 group-hover/people:opacity-100 pointer-events-none group-hover/people:pointer-events-auto",
                  )}
                >
                  <div className="bg-sidebar border border-border rounded-lg shadow-lg p-2 min-w-[160px] space-y-0.5">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      People
                    </p>
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
                </div>
              )}
            </div>
          )}

          {/* Stakeholders */}
          {stakeholders.length > 0 && (
            <div
              className={cn("pt-1", collapsed && "relative group/stakeholders")}
            >
              <button
                type="button"
                onClick={() =>
                  collapsed
                    ? setOpenFlyout((o) =>
                        o === "stakeholders" ? null : "stakeholders",
                      )
                    : setStakeholdersOpen((o) => !o)
                }
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all",
                  collapsed && "justify-center px-0",
                )}
                title={collapsed ? "Stakeholders" : undefined}
              >
                <Network className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Stakeholders</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                        stakeholdersOpen && "rotate-180",
                      )}
                    />
                  </>
                )}
              </button>

              {/* Expanded sub-items */}
              {!collapsed && stakeholdersOpen && (
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

              {/* Collapsed flyout */}
              {collapsed && (
                <div
                  className={cn(
                    "absolute left-full top-0 pl-2 z-50 transition-opacity duration-150",
                    openFlyout === "stakeholders"
                      ? "visible opacity-100 pointer-events-auto"
                      : "invisible group-hover/stakeholders:visible opacity-0 group-hover/stakeholders:opacity-100 pointer-events-none group-hover/stakeholders:pointer-events-auto",
                  )}
                >
                  <div className="bg-sidebar border border-border rounded-lg shadow-lg p-2 min-w-[160px] space-y-0.5">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Stakeholders
                    </p>
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
                </div>
              )}
            </div>
          )}

          {/* Settings section */}
          <div className={cn("pt-2", collapsed && "relative group/settings")}>
            <button
              type="button"
              onClick={() =>
                collapsed
                  ? setOpenFlyout((o) => (o === "settings" ? null : "settings"))
                  : setSettingsOpen((o) => !o)
              }
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                collapsed && "justify-center px-0",
                isSettingsActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Settings</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      settingsOpen && "rotate-180",
                    )}
                  />
                </>
              )}
            </button>

            {/* Expanded sub-items */}
            {!collapsed && settingsOpen && (
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

            {/* Collapsed flyout */}
            {collapsed && (
              <div
                className={cn(
                  "absolute left-full top-0 pl-2 z-50 transition-opacity duration-150",
                  openFlyout === "settings"
                    ? "visible opacity-100 pointer-events-auto"
                    : "invisible group-hover/settings:visible opacity-0 group-hover/settings:opacity-100 pointer-events-none group-hover/settings:pointer-events-auto",
                )}
              >
                <div className="bg-sidebar border border-border rounded-lg shadow-lg p-2 min-w-[160px] space-y-0.5">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Settings
                  </p>
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
              </div>
            )}
          </div>
        </nav>

        {/* Dismiss backdrop for touch flyouts */}
        {openFlyout && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenFlyout(null)}
          />
        )}

        {/* User footer */}
        <div
          className={cn(
            "p-3 flex gap-3",
            collapsed ? "flex-col items-center" : "items-center",
          )}
        >
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
          <Link
            href="/account"
            className={cn(
              "flex items-center gap-3 hover:opacity-80 transition-opacity",
              collapsed ? "" : "flex-1 min-w-0",
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.role}
                </p>
              </div>
            )}
          </Link>
          {!collapsed && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={toggleTheme}
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleSignOut}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
