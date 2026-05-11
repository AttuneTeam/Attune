"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, GitBranch, Link2, Mail, KeyRound, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function AccountPageClient({
  profile,
  email,
  hasGoogleCalendar,
  availableRoles,
}: {
  profile: Profile | null;
  email: string;
  hasGoogleCalendar: boolean;
  availableRoles: { id: string; title: string }[];
}) {
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(hasGoogleCalendar);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [role, setRole] = useState(profile?.role ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedin_url ?? "");
  const [githubHandle, setGithubHandle] = useState(profile?.github_handle ?? "");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(profile?.role_ids ?? []);

  function toggleRole(id: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          role: role.trim(),
          linkedin_url: linkedinUrl.trim() || null,
          github_handle: githubHandle.trim() || null,
          role_ids: selectedRoleIds,
        })
        .eq("id", profile?.id ?? "");

      if (error) throw error;
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectGoogle() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setGoogleConnected(false);
      toast.success("Google Calendar disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleResetPassword() {
    setResetting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success("Reset link sent — check your email");
    } catch {
      toast.error("Failed to send reset email");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Identity */}
      <SectionCard title="Identity" description="Your name and role title as shown across the app.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </Field>
          <Field label="Role title">
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Team Lead, Marketing Manager, Head of Ops"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Professional links */}
      <SectionCard
        title="Professional Links"
        description="Used for context and visible on your profile."
      >
        <Field label="LinkedIn">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="linkedin.com/in/your-handle"
            />
          </div>
        </Field>
        <Field label="GitHub">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex items-center flex-1">
              <span className="text-xs text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md px-3 py-2 h-9 flex items-center">
                github.com/
              </span>
              <Input
                className="rounded-l-none"
                value={githubHandle}
                onChange={(e) => setGithubHandle(e.target.value)}
                placeholder="your-handle"
              />
            </div>
          </div>
        </Field>
      </SectionCard>

      {/* Roles */}
      {availableRoles.length > 0 && (
        <SectionCard
          title="Your Roles"
          description="Select the role definitions from your org that apply to you."
        >
          <div className="flex flex-wrap gap-2">
            {availableRoles.map((r) => {
              const selected = selectedRoleIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRole(r.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                  {r.title}
                </button>
              );
            })}
          </div>
          {availableRoles.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No roles defined yet.{" "}
              <a href="/roles" className="underline underline-offset-2 hover:text-foreground">
                Add roles
              </a>{" "}
              to link them here.
            </p>
          )}
        </SectionCard>
      )}

      {/* Integrations */}
      <SectionCard title="Integrations" description="Connected services.">
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-medium">
              G
            </div>
            <div>
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-xs text-muted-foreground">Sync upcoming events to the personal tab</p>
            </div>
          </div>
          {googleConnected ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3 text-[#6D998F]" />
                Connected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground hover:text-destructive"
                onClick={handleDisconnectGoogle}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Disconnect"
                )}
              </Button>
            </div>
          ) : (
            <a href="/api/auth/google">
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connect
              </Button>
            </a>
          )}
        </div>
      </SectionCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Account */}
      <SectionCard title="Account">
        <div className="space-y-3">
          <Field label="Email">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input value={email} readOnly className="text-muted-foreground bg-muted cursor-default" />
            </div>
          </Field>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPassword}
              disabled={resetting}
              className="gap-2"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {resetting ? "Sending…" : "Reset password"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5">
              We&apos;ll send a reset link to your email address.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
