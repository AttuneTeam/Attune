"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ChevronDown, Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Citation = {
  source_type: "interaction" | "review" | "goal" | "comment";
  source_id: string;
  date: string;
  quote: string;
};

type PersonaClaim = {
  claim: string;
  type: "observation" | "inference";
  confidence: "high" | "medium" | "low";
  evidence: Citation[];
  trend?: "emerging" | "stable" | "fading";
  first_seen: string;
  last_seen: string;
};

type PersonaContent = {
  one_liner: string;
  fields: Record<string, PersonaClaim[]>;
  as_of: string;
};

interface Props {
  memberId: string;
  memberName: string;
  persona: PersonaContent | null;
  version: number | null;
  updatedAt: string | null;
  lastChange: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  communication_style: "Communication style",
  motivators: "Motivators",
  stress_signature: "Stress signature",
  feedback_that_lands: "Feedback that lands",
  growth_edge: "Growth edge",
  open_threads: "Open threads",
};

// Field render order matches the persona spec.
const FIELD_ORDER = [
  "communication_style",
  "motivators",
  "stress_signature",
  "feedback_that_lands",
  "growth_edge",
  "open_threads",
];

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "#6D998F",
  medium: "#F0A539",
  low: "#94a3b8",
};

function safeDate(iso: string, fmt: string): string {
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
}

function EvidenceChip({ cite }: { cite: Citation }) {
  const label = safeDate(cite.date, "MMM d");
  if (cite.source_type === "interaction") {
    return (
      <Link
        href={`/interactions/${cite.source_id}`}
        title={cite.quote}
        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
      >
        {label}
      </Link>
    );
  }
  return (
    <span
      title={cite.quote}
      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize"
    >
      {cite.source_type} · {label}
    </span>
  );
}

function ClaimRow({ claim }: { claim: PersonaClaim }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: CONFIDENCE_COLOR[claim.confidence] }}
        title={`${claim.confidence} confidence`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed text-foreground">
          {claim.claim}
          {claim.type === "inference" && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              inferred
            </span>
          )}
          {claim.trend === "fading" && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              fading
            </span>
          )}
        </p>
        {claim.evidence.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {claim.evidence.map((e, i) => (
              <EvidenceChip key={i} cite={e} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export function MemberPersonaCard({
  memberId,
  memberName,
  persona,
  version,
  updatedAt,
  lastChange,
}: Props) {
  const [open, setOpen] = useState(true);
  const [building, setBuilding] = useState(false);
  const router = useRouter();

  const firstName = memberName.split(" ")[0];

  async function handleBuild() {
    setBuilding(true);
    try {
      const res = await fetch("/api/ai/backfill-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Couldn't build the profile. Please try again.");
        return;
      }
      if (data?.created) {
        toast.success(`Built ${firstName}'s working-style profile.`);
        router.refresh();
      } else if (data?.reason === "no_summarised_interactions") {
        toast.info(
          `No summarised interactions yet — Process at least one interaction with ${firstName} first.`,
        );
      } else if (data?.reason) {
        toast.error(`Couldn't save the profile: ${data.reason}`);
      } else {
        toast.info("Nothing to build yet.");
      }
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-1.5">
          <Fingerprint className="h-3.5 w-3.5" />
          <h2 className="text-sm font-semibold">Working-style profile</h2>
          {version !== null && (
            <span className="text-[10px] text-muted-foreground">v{version}</span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {!persona ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Build a synthesised, evidence-anchored profile of how it is to
                work with {firstName} — communication style, motivators, stress
                signature, and growth edge — from their interaction history.
                After this, each Processed interaction updates it automatically.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBuild}
                disabled={building}
              >
                {building ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Building…
                  </>
                ) : (
                  "Build profile"
                )}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-foreground">
                {persona.one_liner}
              </p>

              {lastChange && (
                <p className="text-[11px] text-muted-foreground italic">
                  Last change: {lastChange}
                </p>
              )}

              {FIELD_ORDER.map((key) => {
                const claims = persona.fields?.[key] ?? [];
                if (claims.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      {FIELD_LABELS[key] ?? key}
                    </p>
                    <ul className="space-y-2">
                      {claims.map((c, i) => (
                        <ClaimRow key={i} claim={c} />
                      ))}
                    </ul>
                  </div>
                );
              })}

              <div className="flex items-center justify-between border-t pt-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: CONFIDENCE_COLOR.high }}
                    />
                    high
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: CONFIDENCE_COLOR.medium }}
                    />
                    medium
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: CONFIDENCE_COLOR.low }}
                    />
                    low
                  </span>
                </span>
                {updatedAt && <span>Updated {safeDate(updatedAt, "MMM d")}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
