"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

// ── Option lists ──────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "SaaS",
  "FinTech",
  "HealthTech",
  "E-commerce",
  "Gaming",
  "Enterprise Software",
  "Consulting",
  "Deep Tech",
  "Consumer",
  "Media",
  "Marketplace",
  "Retail",
  "Manufacturing",
  "Financial Services",
  "Healthcare",
  "Education",
  "Government",
  "Non-profit",
  "Professional Services",
  "Other",
];

const STAGES = [
  "Pre-seed / Seed (<10)",
  "Early-stage (10–50)",
  "Scale-up (50–250)",
  "Growth (250–1000)",
  "Enterprise (1000+)",
];

const HEADCOUNTS = ["<10", "10–25", "25–50", "50–100", "100–250", "250+"];

const TEAM_FUNCTIONS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "Marketing",
  "Customer Success",
  "Operations",
  "Finance",
  "HR",
  "Research",
  "Legal",
  "Data & Analytics",
  "Other",
];

const TEAM_SIZES = ["2–4", "5–8", "9–15", "16–25", "25+"];

const TEAM_METHODOLOGIES = [
  "Scrum / Sprints",
  "Kanban / Continuous flow",
  "Shape Up",
  "Dual-track (discovery + delivery)",
  "Campaign-based",
  "Monthly targets / quota cycles",
  "Waterfall / Stage-gate",
  "SAFe — Scaled Agile Framework",
  "Custom / Hybrid",
];

const COMPANY_PLANNING_CADENCES = [
  "OKR cycles — quarterly",
  "OKR cycles — annual",
  "Rockefeller Habits (quarterly rocks)",
  "Annual / budget-led planning",
  "Quarterly business review (QBR)",
  "None / ad-hoc",
];

const DECISION_FRAMEWORKS = [
  "DRI — Directly Responsible Individual (Apple)",
  "Single-Threaded Owner (Amazon)",
  "RACI matrix",
  "Consensus-driven",
  "Flat / Autonomous teams",
  "Hierarchical / top-down",
];

const TEAM_STRUCTURES = [
  "Functional (all same discipline)",
  "Cross-functional squad",
  "Matrix (functional + project reporting)",
  "Embedded (spread across other teams or BUs)",
  "Pod / small autonomous group",
  "Centre of Excellence",
  "Geographic / regional team",
  "Project-based / temporary",
  "Hybrid",
];

const OKR_CADENCES = ["Annual", "Quarterly", "Six-monthly", "None / ad-hoc"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgContextData {
  company_name?: string | null;
  website?: string | null;
  industry?: string | null;
  company_stage?: string | null;
  company_headcount?: string | null;
  countries?: string[] | null;
  team_function?: string | null;
  team_size?: string | null;
  key_tools?: string[] | null;
  team_methodology?: string | null;
  company_planning?: string | null;
  decision_framework?: string | null;
  team_structure?: string | null;
  okr_cadence?: string | null;
  company_mission?: string | null;
  management_principles?: string | null;
  updated_at?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tagsToString(arr: string[] | null | undefined): string {
  return (arr ?? []).join(", ");
}

function stringToTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">—</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OrgContextForm({
  initialData,
}: {
  initialData: OrgContextData | null;
}) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(
    initialData?.updated_at ?? null
  );

  // Company
  const [companyName, setCompanyName] = useState(initialData?.company_name ?? "");
  const [website, setWebsite] = useState(initialData?.website ?? "");
  const [industry, setIndustry] = useState(initialData?.industry ?? "");
  const [companyStage, setCompanyStage] = useState(initialData?.company_stage ?? "");
  const [companyHeadcount, setCompanyHeadcount] = useState(initialData?.company_headcount ?? "");
  const [countriesInput, setCountriesInput] = useState(tagsToString(initialData?.countries));

  // Team
  const [teamFunction, setTeamFunction] = useState(initialData?.team_function ?? "");
  const [teamSize, setTeamSize] = useState(initialData?.team_size ?? "");
  const [keyToolsInput, setKeyToolsInput] = useState(tagsToString(initialData?.key_tools));

  // Ways of Working
  const [teamMethodology, setTeamMethodology] = useState(initialData?.team_methodology ?? "");
  const [companyPlanning, setCompanyPlanning] = useState(initialData?.company_planning ?? "");
  const [decisionFramework, setDecisionFramework] = useState(initialData?.decision_framework ?? "");
  const [teamStructure, setTeamStructure] = useState(initialData?.team_structure ?? "");
  const [okrCadence, setOkrCadence] = useState(initialData?.okr_cadence ?? "");

  // Culture
  const [companyMission, setCompanyMission] = useState(initialData?.company_mission ?? "");
  const [managementPrinciples, setManagementPrinciples] = useState(initialData?.management_principles ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/org-context", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName || null,
          website: website || null,
          industry: industry || null,
          company_stage: companyStage || null,
          company_headcount: companyHeadcount || null,
          countries: stringToTags(countriesInput),
          team_function: teamFunction || null,
          team_size: teamSize || null,
          key_tools: stringToTags(keyToolsInput),
          team_methodology: teamMethodology || null,
          company_planning: companyPlanning || null,
          decision_framework: decisionFramework || null,
          team_structure: teamStructure || null,
          okr_cadence: okrCadence || null,
          company_mission: companyMission || null,
          management_principles: managementPrinciples || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
        return;
      }

      const data = await res.json();
      setSavedAt(data.updated_at ?? null);
      toast.success("Context saved");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Company */}
      <SectionCard
        title="Company"
        description="Grounds AI analysis on your market context, scale, and customer base."
      >
        <FieldRow>
          <Field label="Company name">
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
            />
          </Field>
          <Field label="Website">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <FieldSelect
            label="Industry"
            value={industry}
            onChange={setIndustry}
            options={INDUSTRIES}
          />
          <FieldSelect
            label="Company stage"
            value={companyStage}
            onChange={setCompanyStage}
            options={STAGES}
          />
        </FieldRow>
        <FieldRow>
          <FieldSelect
            label="Company headcount"
            value={companyHeadcount}
            onChange={setCompanyHeadcount}
            options={HEADCOUNTS}
          />
          <Field label="Countries (comma-separated)">
            <Input
              value={countriesInput}
              onChange={(e) => setCountriesInput(e.target.value)}
              placeholder="UK, US, Germany"
            />
          </Field>
        </FieldRow>
      </SectionCard>

      {/* Team */}
      <SectionCard
        title="Team"
        description="Calibrates what good coverage looks like for your specific team function and size."
      >
        <FieldRow>
          <FieldSelect
            label="Team function"
            value={teamFunction}
            onChange={setTeamFunction}
            options={TEAM_FUNCTIONS}
          />
          <FieldSelect
            label="Team size (your direct reports)"
            value={teamSize}
            onChange={setTeamSize}
            options={TEAM_SIZES}
          />
        </FieldRow>
        <Field label="Key tools (comma-separated)" className="sm:col-span-2">
          <Input
            value={keyToolsInput}
            onChange={(e) => setKeyToolsInput(e.target.value)}
            placeholder="Salesforce, Jira, Figma, Notion…"
          />
        </Field>
      </SectionCard>

      {/* Ways of Working */}
      <SectionCard
        title="Ways of Working"
        description="The strongest signal for coaching questions and gap analysis — how your team plans, decides, and organises itself."
      >
        <FieldRow>
          <FieldSelect
            label="Team methodology (day-to-day)"
            value={teamMethodology}
            onChange={setTeamMethodology}
            options={TEAM_METHODOLOGIES}
          />
          <FieldSelect
            label="Company planning cadence"
            value={companyPlanning}
            onChange={setCompanyPlanning}
            options={COMPANY_PLANNING_CADENCES}
          />
        </FieldRow>
        <FieldRow>
          <FieldSelect
            label="Decision framework"
            value={decisionFramework}
            onChange={setDecisionFramework}
            options={DECISION_FRAMEWORKS}
          />
          <FieldSelect
            label="Team structure"
            value={teamStructure}
            onChange={setTeamStructure}
            options={TEAM_STRUCTURES}
          />
        </FieldRow>
        <FieldRow>
          <FieldSelect
            label="OKR cadence"
            value={okrCadence}
            onChange={setOkrCadence}
            options={OKR_CADENCES}
          />
        </FieldRow>
      </SectionCard>

      {/* Culture */}
      <SectionCard
        title="Culture"
        description="Shapes coaching question tone and alignment discussions — the nuance that structured fields can't capture."
      >
        <Field label="Company mission">
          <Textarea
            value={companyMission}
            onChange={(e) => setCompanyMission(e.target.value)}
            placeholder="What the company exists to do…"
            rows={2}
          />
        </Field>
        <Field label="Your management principles">
          <Textarea
            value={managementPrinciples}
            onChange={(e) => setManagementPrinciples(e.target.value)}
            placeholder="e.g. I coach rather than direct. My team is mostly senior ICs who need context, not tasks…"
            rows={3}
          />
        </Field>
      </SectionCard>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {savedAt ? (
          <p className="text-xs text-muted-foreground">
            Last saved{" "}
            {new Date(savedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        ) : (
          <span />
        )}
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save context"}
        </Button>
      </div>
    </div>
  );
}
